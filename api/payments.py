from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
import stripe
from supabase import create_client, Client
import databutton as db
import json
from typing import TypedDict, Literal
from datetime import datetime
from app.auth import AuthorizedUser
import json as json_module
import os
from app.env import Mode, mode

# [Previous configuration constants remain the same: ProductConfig, TEST_PRODUCT_CONFIG, etc.]

# Set the product configuration based on the environment flag
PRODUCT_CONFIG: dict[str, ProductConfig] = TEST_PRODUCT_CONFIG if USE_TEST_ENVIRONMENT else PRODUCTION_PRODUCT_CONFIG
PRICE_IDS = TEST_PRICE_IDS if USE_TEST_ENVIRONMENT else PRODUCTION_PRICE_IDS

# Initialize Supabase client
supabase_url = db.secrets.get("SUPABASE_URL")
supabase_key = db.secrets.get("SUPABASE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

router = APIRouter()

@router.get("/test-stripe-connection")
def test_stripe_connection():
    # [This function remains largely unchanged]
    # ... existing implementation ...
    pass

# Initialize Stripe with the appropriate API key based on environment flag
stripe.api_key = db.secrets.get("STRIPE_TEST_SECRET_KEY") if USE_TEST_ENVIRONMENT else db.secrets.get("STRIPE_SECRET_KEY")

def get_product_config(price_id: str) -> ProductConfig | None:
    # [This function remains unchanged]
    # ... existing implementation ...
    pass

class CreateCheckoutSession(BaseModel):
    price_id: str
    success_url: str
    cancel_url: str

@router.post("/create-checkout")
def create_checkout_session(body: CreateCheckoutSession, user: AuthorizedUser):
    try:
        # Get or create customer
        user_response = supabase.table("users").select("*").eq("id", user.sub).execute()
        user_data = user_response.data[0] if user_response.data else {}
        customer_id = user_data.get("stripeCustomerId")
        customer_email = user_data.get("email")
        
        if not customer_id:
            customer_name = user_data.get("displayMame")
            customer_params = {
                "metadata": {"supabase_uid": user.sub},
                "email": customer_email
            }
            if customer_name:
                customer_params["name"] = customer_name
                
            customer = stripe.Customer.create(**customer_params)
            customer_id = customer.id
            
            # Update user table with stripe customer id
            try:
                update_response = supabase.table("users").update({
                    "stripeCustomerId": customer_id
                }).eq("id", user.sub).execute()
                
                if not update_response.data:
                    raise HTTPException(status_code=500, detail="Failed to update user data")
            except Exception as e:
                print(f"Error updating user with stripe customer id: {str(e)}")
                raise HTTPException(status_code=500, detail="Failed to update user data")

        # [Rest of the function remains largely the same]
        product_config = get_product_config(body.price_id)
        if not product_config:
            raise HTTPException(status_code=400, detail="Invalid product")
            
        mode = "subscription" if product_config["type"] == "monthly" else "payment"
        
        session = stripe.checkout.Session.create(
            customer_email=customer_email,
            payment_method_types=["card"],
            line_items=[{
                "price": body.price_id,
                "quantity": 1,
            }],
            mode=mode,
            success_url=body.success_url,
            cancel_url=body.cancel_url,
            client_reference_id=user.sub,
            metadata={
                "supabase_uid": user.sub,
                "product_type": product_config["type"]
            }
        )

        return {"session_id": session.id}
        
    except Exception as e:
        print(f"Error creating checkout session: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        webhook_secret = db.secrets.get("STRIPE_TEST_WEBHOOK_SECRET") if USE_TEST_ENVIRONMENT else db.secrets.get("STRIPE_WEBHOOK_SECRET")
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid payload") from e
        
    if event["type"] == "customer.subscription.created":
        subscription = event["data"]["object"]
        return handle_subscription_created(subscription)
    elif event["type"] == "customer.subscription.updated":
        subscription = event["data"]["object"]
        return handle_subscription_updated(subscription)
    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        return handle_subscription_deleted(subscription)
    elif event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        
        if session.get("mode") == "subscription":
            return {"status": "success", "message": "Skipping subscription purchase"}
        
        customer_id = session.get("customer")
        customer_email = session.get("customer_details", {}).get("email")
        session_id = session.get("id")
        
        if not customer_email:
            print("No customer email found in session")
            return {"status": "error", "message": "No customer email found"}
        
        # Get user by email
        user_response = supabase.table("users").select("*").eq("email", customer_email).limit(1).execute()
        
        if not user_response.data:
            print(f"No user found for email {customer_email}")
            return {"status": "error", "message": "User not found"}
        
        user_data = user_response.data[0]
        user_id = user_data["id"]
        
        # Update user with Stripe customer ID if not set
        if not user_data.get("stripeCustomerId"):
            supabase.table("users").update({
                "stripeCustomerId": customer_id
            }).eq("id", user_id).execute()
        
        line_items = stripe.checkout.Session.list_line_items(session_id)
        total_credits = 0
        
        for item in line_items.data:
            product_config = get_product_config(item.price.id)
            if product_config and product_config["type"] == "one_time":
                total_credits += product_config["credits"]
        
        if total_credits > 0:
            current_credits = user_data.get("credits", 0)
            updated_data = {
                "credits": current_credits + total_credits,
                "stripeCustomerId": customer_id,
                "lastActive": datetime.utcnow().isoformat(),
            }
            
            supabase.table("users").update(updated_data).eq("id", user_id).execute()
            
            print(f"Updated credits for user {user_id}: +{total_credits} credits")
            
        return {
            "status": "success",
            "message": f"Updated credits for user {user_id}: +{total_credits} credits"
        }
    return {"status": "success", "credits_added": 0}

def handle_subscription_created(subscription):
    customer_id = subscription.get("customer")
    if not customer_id:
        return {"status": "error", "credits_added": 0, "message": "No customer ID found"}

    stripe_customer = stripe.Customer.retrieve(customer_id)
    customer_email = stripe_customer.get("email")
    
    if not customer_email:
        return {"status": "error", "message": "No customer email found"}

    user_response = supabase.table("users").select("*").eq("email", customer_email).limit(1).execute()
    
    if not user_response.data:
        return {"status": "error", "message": "User not found"}

    user_data = user_response.data[0]
    user_id = user_data["id"]

    if not user_data.get("stripeCustomerId"):
        supabase.table("users").update({"stripeCustomerId": customer_id}).eq("id", user_id).execute()

    subscription_item = subscription.get("items", {}).get("data", [])[0]
    if not subscription_item:
        return {"status": "error", "credits_added": 0, "message": "No subscription items found"}
        
    price_id = subscription_item.get("price", {}).get("id")
    if not price_id:
        return {"status": "error", "credits_added": 0, "message": "No price ID found"}
        
    product_config = get_product_config(price_id)
    if not product_config:
        return {"status": "error", "credits_added": 0, "message": "No product config found"}
        
    total_credits = product_config["credits"]

    subscription_data = {
        # [Same subscription_data structure as before]
        "subscriptionId": subscription.get("id"),
        "status": subscription.get("status"),
        "currentPeriodStart": datetime.fromtimestamp(subscription.get("current_period_start", 0)).isoformat(),
        "currentPeriodEnd": datetime.fromtimestamp(subscription.get("current_period_end", 0)).isoformat(),
        # ... rest of the fields ...
        "userId": user_id,
    }
    
    supabase.table("subscriptions").upsert(subscription_data).execute()
    
    updated_data = {
        "subscriptionStatus": "active",
        "subscriptionTier": "monthly",
        "lastActive": datetime.utcnow().isoformat(),
    }
    
    supabase.table("users").update(updated_data).eq("id", user_id).execute()
    
    return {
        "status": "success",
        "credits_added": total_credits,
        "message": f"Created subscription for user {user_id}"
    }

# [Update handle_subscription_updated and handle_subscription_deleted similarly]
# Replace Firestore operations with Supabase table operations
# Use .select(), .update(), .upsert(), .eq() instead of Firestore equivalents

def handle_subscription_updated(subscription):
    # Similar changes: replace Firestore with Supabase operations
    customer_id = subscription.get("customer")
    stripe_customer = stripe.Customer.retrieve(customer_id)
    customer_email = stripe_customer.get("email")
    
    user_response = supabase.table("users").select("*").eq("email", customer_email).limit(1).execute()
    if not user_response.data:
        return {"status": "error", "message": "User not found"}
        
    user_data = user_response.data[0]
    user_id = user_data["id"]
    
    # ... rest of the logic ...
    subscription_response = supabase.table("subscriptions").select("*").eq("userId", user_id).execute()
    # Update subscription and user data using supabase.table().update()
    
def handle_subscription_deleted(subscription):
    # Similar changes: replace Firestore with Supabase operations
    customer_id = subscription.get("customer")
    stripe_customer = stripe.Customer.retrieve(customer_id)
    customer_email = stripe_customer.get("email")
    
    user_response = supabase.table("users").select("*").eq("email", customer_email).limit(1).execute()
    if not user_response.data:
        return {"status": "error", "message": "User not found"}
        
    user_data = user_response.data[0]
    user_id = user_data["id"]
    
    # ... rest of the logic ...
    # Update subscription and user data using supabase.table().update()
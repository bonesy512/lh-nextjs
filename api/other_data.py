from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import requests
from supabase import create_client, Client
from datetime import datetime
from dotenv import load_dotenv
import os

# Router for endpoints
router = APIRouter()

# Load environment variables
load_dotenv()

# Initialize Supabase client with environment variables
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
if not supabase_url or not supabase_key:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in .env file")
supabase: Client = create_client(supabase_url, supabase_key)

# Get Google Maps API key from environment variables
google_maps_api_key = os.getenv("GOOGLE_MAPS_API_KEY")
if not google_maps_api_key:
    raise ValueError("GOOGLE_MAPS_API_KEY must be set in .env file")

class DistanceRequest(BaseModel):
    origins: str  # Format: "lat,long"
    destination: str  # City name

class DistanceResponse(BaseModel):
    distance_text: str
    distance_value: int  # in meters
    duration_text: str
    duration_value: int  # in seconds

@router.post("/distance-to-city")
def get_distance_to_city(body: DistanceRequest) -> DistanceResponse:
    """Get the distance and duration to a city using Google Maps Distance Matrix API"""
    try:
        # Construct the URL
        url = "https://maps.googleapis.com/maps/api/distancematrix/json"
        params = {
            "origins": body.origins,
            "destinations": body.destination,
            "units": "imperial",
            "key": google_maps_api_key
        }
        
        # Make the request
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        # Check for API errors
        if data.get("status") != "OK":
            raise HTTPException(
                status_code=400,
                detail=f"Google Maps API error: {data.get('status', 'Unknown error')}"
            )
            
        # Get the first route
        elements = data.get("rows", [{}])[0].get("elements", [{}])[0]
        
        if elements.get("status") != "OK":
            raise HTTPException(
                status_code=400,
                detail=f"Route error: {elements.get('status', 'Unknown error')}"
            )
        
        # Extract distance and duration
        distance = elements.get("distance", {})
        duration = elements.get("duration", {})
        
        result = DistanceResponse(
            distance_text=distance.get("text", "N/A"),
            distance_value=distance.get("value", 0),
            duration_text=duration.get("text", "N/A"),
            duration_value=duration.get("value", 0)
        )
        
        # Store the request and result in Supabase
        try:
            request_data = {
                "origins": body.origins,
                "destination": body.destination,
                "distance_text": result.distance_text,
                "distance_value": result.distance_value,
                "duration_text": result.duration_text,
                "duration_value": result.duration_value,
                "created_at": datetime.utcnow().isoformat(),
                "status": "success"
            }
            supabase.table("distance_requests").insert(request_data).execute()
        except Exception as e:
            print(f"Failed to store distance request in Supabase: {str(e)}")
            # Don't fail the request if storage fails
            
        return result
        
    except requests.RequestException as e:
        # Store failed request
        try:
            error_data = {
                "origins": body.origins,
                "destination": body.destination,
                "error": str(e),
                "created_at": datetime.utcnow().isoformat(),
                "status": "error"
            }
            supabase.table("distance_requests").insert(error_data).execute()
        except Exception as store_e:
            print(f"Failed to store error in Supabase: {str(store_e)}")
            
        raise HTTPException(status_code=500, detail=f"Failed to fetch distance: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
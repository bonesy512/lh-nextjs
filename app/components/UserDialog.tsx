import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUserGuardContext } from "app";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOutIcon, CoinsIcon, PlusCircleIcon } from "lucide-react";
import { firebaseAuth, firebaseApp } from "app";

import { useAppStore } from "@/utils/store";
import { useEffect, useState } from "react";

// Set this to true to use test environment, false to use production
const USE_TEST_ENVIRONMENT = true;

// Stripe public keys
const STRIPE_TEST_PUBLIC_KEY = "pk_test_51QwbVmQD0tmjQB7AGQpOUal8TwMT8Q705HqW8S2g07MjYhlT9NTnFQBaE0BiN55PkzkKaO3MuGPnvsQfrYOsHiRP00h0YNLjUp";
const STRIPE_PRODUCTION_PUBLIC_KEY = "pk_live_51Qbr7iGPQrpE7XHPIwZFDqkTEMJFjIAoozLz23yLuRgXK0ogjmXy4b2eS35MnpzWXh8ie6bFePuxw905dUATBg0G00KPGx1a7s";

// Price IDs
const TEST_PRICE_IDS = {
  MONTHLY: "price_1QwdxMQD0tmjQB7AzDZquNZO",   // Monthly subscription
  TOKENS_500: "price_1Qwe11QD0tmjQB7AQWs7M9nE",  // 500 tokens
  TOKENS_1250: "price_1QwdzOQD0tmjQB7Ap9CLBHBn", // 1250 tokens
  TOKENS_2500: "price_1Qwe0UQD0tmjQB7ALfloZuTq"  // 2500 tokens
};

const PRODUCTION_PRICE_IDS = {
  MONTHLY: "price_1QwaGDGPQrpE7XHPsBGjwnax",   // Monthly subscription
  TOKENS_500: "price_1QwaQCGPQrpE7XHPaWlhn5eN",  // 500 tokens
  TOKENS_1250: "price_1QwaQmGPQrpE7XHPf7bW4yF7", // 1250 tokens
  TOKENS_2500: "price_1QwaR9GPQrpE7XHPGB5Hn9GU"  // 2500 tokens
};

// Select the appropriate set based on environment
const PRICE_IDS = USE_TEST_ENVIRONMENT ? TEST_PRICE_IDS : PRODUCTION_PRICE_IDS;
const STRIPE_PUBLIC_KEY = USE_TEST_ENVIRONMENT ? STRIPE_TEST_PUBLIC_KEY : STRIPE_PRODUCTION_PUBLIC_KEY;

import { loadStripe } from "@stripe/stripe-js";
import brain from "brain";

export interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserDialog({ open, onOpenChange }: Props) {
  const { user } = useUserGuardContext();
  const { userProfile, isLoadingProfile, initializeUserProfileListener } = useAppStore();

  useEffect(() => {
    if (!user) return;
    const unsubscribe = initializeUserProfileListener(user.uid);
    return () => unsubscribe();
  }, [user, initializeUserProfileListener]);

  const handlePurchase = async (productId: string) => {
    try {
      const response = await brain.create_checkout_session({
        price_id: productId,
        success_url: `${window.location.origin}${window.location.pathname}?payment=success`,
        cancel_url: `${window.location.origin}${window.location.pathname}?payment=cancelled`,
      });
      const data = await response.json();
      console.log(data)

      const stripe = await loadStripe(STRIPE_PUBLIC_KEY);
      if (!stripe) throw new Error("Failed to load Stripe");

      // Open checkout in new tab
      const { error } = await stripe.redirectToCheckout({
        sessionId: data.session_id
      });

      if (error) {
        console.error("Failed to redirect to checkout:", error);
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await firebaseAuth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[80%] max-w-md rounded-xl mx-auto">
        <DialogHeader>
          <DialogTitle>Profile</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-6 p-4">
          <Avatar className="h-24 w-24">
            {user.photoURL ? (
              <AvatarImage src={user.photoURL} alt={user.displayName || "User"} />
            ) : (
              <AvatarFallback>{user.email?.[0].toUpperCase()}</AvatarFallback>
            )}
          </Avatar>
          <div className="text-center space-y-2">
            {user.displayName && (
              <h3 className="text-lg font-semibold">{user.displayName}</h3>
            )}
            <p className="text-sm text-muted-foreground">{user.email}</p>
            {userProfile?.subscriptionTier === "monthly" ? (
              <Badge variant="outline" className="text-green-500 border-green-500">
                Active
              </Badge>
            ) : (
              <Badge 
                variant="outline" 
                className="text-red-500 border-red-500 cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                onClick={() => handlePurchase(PRICE_IDS.MONTHLY)}
              >
                Subscribe Here
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-center gap-2 text-lg font-medium">
            <CoinsIcon className="h-5 w-5 text-yellow-500" />
            <span>{isLoadingProfile ? "..." : userProfile?.credits || 0} credits</span>
          </div>
          <div className="w-full grid grid-cols-3 gap-3">
            <Button
              variant="outline"
              className="flex flex-col items-center justify-center p-4 h-auto border-2 border-blue-500/20 hover:border-blue-500 hover:bg-blue-500/10 transition-all duration-200 hover:scale-105 dark:hover:text-white"
              onClick={() => handlePurchase(PRICE_IDS.TOKENS_500)}
            >
              <div className="font-semibold">500</div>
              <div className="text-sm text-muted-foreground">tokens</div>
              <div className="text-sm font-medium mt-2">$25</div>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col items-center justify-center p-4 h-auto border-2 border-purple-500/20 hover:border-purple-500 hover:bg-purple-500/10 transition-all duration-200 hover:scale-105 dark:hover:text-white"
              onClick={() => handlePurchase(PRICE_IDS.TOKENS_1250)}
            >
              <div className="font-semibold">1250</div>
              <div className="text-sm text-muted-foreground">tokens</div>
              <div className="text-sm font-medium mt-2">$50</div>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col items-center justify-center p-4 h-auto border-2 border-green-500/20 hover:border-green-500 hover:bg-green-500/10 transition-all duration-200 hover:scale-105 dark:hover:text-white"
              onClick={() => handlePurchase(PRICE_IDS.TOKENS_2500)}
            >
              <div className="font-semibold">2500</div>
              <div className="text-sm text-muted-foreground">tokens</div>
              <div className="text-sm font-medium mt-2">$100</div>
            </Button>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleSignOut}
          >
            <LogOutIcon className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

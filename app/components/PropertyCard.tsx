import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";


import { useAppStore } from "@/utils/store";
import { Card } from "@/components/ui/card";
import { HomeIcon, ExternalLinkIcon, XIcon, UserIcon } from "lucide-react";

import type { PropertyDetailsResponse } from "types";
import { toast } from "sonner";

export interface Props {
  onViewMore?: () => void;
}

export function PropertyCard({ onViewMore }: Props) {
  const { setPropertyCardVisible, isLoadingProperty, selectedProperty, userProfile } = useAppStore();

  const handleViewMore = () => {
    console.log("Subscription status:", userProfile?.subscriptionTier, userProfile?.subscriptionStatus);
    
    if (userProfile?.subscriptionTier === "monthly" || userProfile?.subscriptionStatus === "active" || userProfile?.subscriptionStatus === "cancelled_active") {
      console.log("User has active subscription, opening dialog");
      onViewMore();
    } else {
      console.log("User does not have subscription, showing toast");
      toast.error("You need an active subscription to view detailed property analysis", {
        duration: 5000,
        description: "Subscribe in your profile to unlock all features",
        action: {
          label: "Profile",
          onClick: () => {
            // Open user dialog from App.tsx
            const event = new CustomEvent("open-user-dialog");
            window.dispatchEvent(event);
          }
        }
      });
    }
  };

  return (
    <Card className="bg-card shadow-lg rounded-sm">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">
            Property Details
          </h2>
          <div className="flex items-center gap-1">
            {selectedProperty && !isLoadingProperty && selectedProperty.propertyId && (
              <Button
                variant="ghost"
                size="icon"
                title="View Details"
                onClick={handleViewMore}
              >
                <ExternalLinkIcon className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              title="Hide Card"
              onClick={() => setPropertyCardVisible(false)}
            >
              <XIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {isLoadingProperty ? (
          <div className="space-y-4">
            {/* Address */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <HomeIcon className="w-4 h-4" />
                Address
              </div>
              <Skeleton className="h-5 w-full" />
            </div>

            {/* Owner */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <UserIcon className="w-4 h-4" />
                Owner
              </div>
              <Skeleton className="h-5 w-full" />
            </div>
          </div>
        ) : selectedProperty ? (
          <div className="space-y-4">
            {/* Address */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <HomeIcon className="w-4 h-4" />
                Address
              </div>
              <p className="text-sm font-medium break-words">
                {selectedProperty.address?.streetAddress}, {selectedProperty.address?.city}, {selectedProperty.address?.state} {selectedProperty.address?.zipcode}
              </p>
            </div>

            {/* Owner */}
            {selectedProperty.ownerName && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <HomeIcon className="w-4 h-4" />
                  Owner
                </div>
                <p className="text-sm font-medium break-words">
                  {selectedProperty.ownerName}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <p className="text-md text-muted-foreground">Please select a valid property</p>
          </div>
        )}
      </div>
    </Card>
  );
}

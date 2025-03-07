import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GeneratePrice } from "@/components/GeneratePrice";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore } from "@/utils/store";
import brain from "brain";
import { Separator } from "@/components/ui/separator";
import { HomeIcon, MapPinIcon, RulerIcon, DollarSignIcon, CalendarIcon, BedDoubleIcon, BathIcon, ActivityIcon, Car, Droplets, Snowflake, Flame, Trees, Waves, Sparkles, Mountain, ChevronDown, Clock, Route, Bookmark } from "lucide-react";
import { useEffect, useState } from "react";
import { useUserGuardContext } from "app";
import { savePropertyQuery } from "@/utils/firebase";
import { cn } from "@/lib/utils";
import { useQueueStore, PriceJob } from "@/utils/queue";
import type { PropertyDetailsResponse } from "types";

export interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FeatureBadgeProps {
  icon: React.ReactNode;
  label: string;
  value: boolean;
}

function FeatureBadge({ icon, label, value }: FeatureBadgeProps) {
  const presentClass = 'bg-green-500/10 text-green-500 border-green-500';
  const absentClass = 'bg-red-500/10 text-red-500/60 border-red-500/60 line-through';
  return (
    <Badge 
      variant="outline" 
      className={`flex items-center gap-2 px-3 py-1.5 transition-colors ${value ? presentClass : absentClass}`}
    >
      {icon}
      {label}
    </Badge>
  );
}

interface DetailItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | number | null;
  formatter?: (value: any) => string;
}

function DetailItem({ icon, label, value, formatter }: DetailItemProps) {
  const displayValue = value === null ? "N/A" : formatter ? formatter(value) : value;
  
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-sm">{displayValue}</p>
      </div>
    </div>
  );
}

function QueueStatus() {
  const jobs = useQueueStore(state => state.jobs);
  
  if (jobs.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Price Generation Queue</h3>
      <div className="space-y-2">
        {jobs.map((job) => {
          const address = `${job.property.address?.streetAddress}, ${job.property.address?.city}`;
          return (
            <div key={job.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="space-y-1">
                <p className="text-sm font-medium truncate">{address}</p>
                <p className="text-xs text-muted-foreground capitalize">{job.status.replace('-', ' ')}</p>
              </div>
              {job.status === 'completed' && (
                <Badge variant="success" className="capitalize">
                  {job.predictedPrice?.predicted_price}
                </Badge>
              )}
              {job.status === 'error' && (
                <Badge variant="destructive" className="capitalize">
                  Error
                </Badge>
              )}
              {(job.status === 'fetching-prices' || job.status === 'predicting') && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {job.status === 'queued' && (
                <Badge variant="secondary" className="capitalize">
                  Queued
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PropertyDialog({ open, onOpenChange }: Props) {
  const { user } = useUserGuardContext();
  const { selectedProperty, setSelectedProperty, isLoadingProperty, setIsLoadingProperty, savedProperties } = useAppStore();

  useEffect(() => {
    if (open && selectedProperty && savedProperties) {
      // Find matching saved property by propertyId
      const savedProperty = savedProperties.find(
        (saved) => saved.propertyId === selectedProperty.propertyId
      );

      // If found, update selectedProperty with saved data
      if (savedProperty) {
        setSelectedProperty(savedProperty);
      }
    }
  }, [open, selectedProperty?.address, savedProperties, setSelectedProperty]);
  
  const renderParcelInfo = () => {
    if (!(selectedProperty?.propertyId || selectedProperty?.ownerName || selectedProperty?.gisArea || selectedProperty?.landValue)) {
      return null;
    }

    return (
      <>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Parcel Information</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {selectedProperty?.propertyId && (
              <DetailItem
                icon={<HomeIcon className="w-4 h-4" />}
                label="Property ID"
                value={selectedProperty.propertyId}
              />
            )}
            {selectedProperty?.address && (
              <DetailItem
                icon={<MapPinIcon className="w-4 h-4" />}
                label="Address"
                value={`${selectedProperty.address.streetAddress}, ${selectedProperty.address.city}, ${selectedProperty.address.state} ${selectedProperty.address.zipcode}`}
              />
            )}
            {selectedProperty?.ownerName && (
              <DetailItem
                icon={<HomeIcon className="w-4 h-4" />}
                label="Owner"
                value={selectedProperty.ownerName}
              />
            )}
            {selectedProperty?.gisArea && (
              <DetailItem
                icon={<RulerIcon className="w-4 h-4" />}
                label="GIS Area"
                value={`${selectedProperty.gisArea} ${selectedProperty.gisAreaUnits || ''}`}
              />
            )}
            {selectedProperty?.legalAreaUnits && (
              <DetailItem
                icon={<RulerIcon className="w-4 h-4" />}
                label="Legal Area Units"
                value={selectedProperty.legalAreaUnits}
              />
            )}

            {selectedProperty?.improvementValue && (
              <DetailItem
                icon={<DollarSignIcon className="w-4 h-4" />}
                label="Improvement Value"
                value={selectedProperty.improvementValue}
                formatter={(value) => `$${value?.toLocaleString()}`}
              />
            )}

            {selectedProperty?.dateAcquired && (
              <DetailItem
                icon={<CalendarIcon className="w-4 h-4" />}
                label="Date Acquired"
                value={selectedProperty.dateAcquired}
                formatter={(value) => new Date(value).toLocaleDateString()}
              />
            )}
            {selectedProperty?.taxYear && (
              <DetailItem
                icon={<CalendarIcon className="w-4 h-4" />}
                label="Tax Year"
                value={selectedProperty.taxYear}
              />
            )}
          </div>
        </div>
        <Separator />
      </>
    );
  };

  const renderPropertyDetails = () => null;

  return (
    <Dialog open={open} onOpenChange={(open) => open || onOpenChange(false)}>
      <DialogContent className="w-[95vw] max-h-[90vh] overflow-hidden rounded-lg" onInteractOutside={(event) => event.preventDefault()} >
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <HomeIcon className="w-5 h-5" />
            Property Details
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-8rem)] px-2 md:pr-4 md:-mr-4">
          {isLoadingProperty ? (
            <div className="space-y-6">
              <div className="space-y-4">
                <Skeleton className="h-6 w-32" />
                <div className="grid gap-4 sm:grid-cols-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-6 w-full" />
                    </div>
                  ))}
                </div>
              </div>
              <Skeleton className="h-px w-full" />
              <div className="space-y-4">
                <Skeleton className="h-6 w-32" />
                <div className="grid gap-4 sm:grid-cols-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-6 w-full" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {renderParcelInfo()}
              {renderPropertyDetails()}
              <GeneratePrice />
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

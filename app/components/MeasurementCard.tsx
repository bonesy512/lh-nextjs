import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { MinusIcon, SquareIcon, XIcon, TrashIcon, PlusIcon } from "lucide-react";
import { useAppStore } from "@/utils/store";

export function MeasurementCard() {
  const { 
    measurementMode, 
    setMeasurementMode, 
    clearMeasurements,
    measurementPoints,
    addMeasurementPoint,
    viewportCenter,
    currentMeasurement
  } = useAppStore();

  const formatMeasurement = (value: number) => {
    if (measurementMode === "distance") {
      // Convert miles to feet if less than 0.1 miles
      return value < 0.1
        ? `${(value * 5280).toFixed(0)} ft`
        : `${value.toFixed(2)} mi`;
    } else {
      // Convert square meters to acres
      return `${value.toFixed(2)} acres`;
    }
  };

  return (
    <Card className="bg-card shadow-lg rounded-sm">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">
            Measurement Tools
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setMeasurementMode("none");
              clearMeasurements();
            }}
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="flex border rounded-md overflow-hidden">
              <Button
                variant="ghost"
                size="sm"
                className={`px-3 rounded-none border-r ${measurementMode === "distance" ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" : "hover:bg-primary/90 hover:text-primary-foreground"}`}
                onClick={() => setMeasurementMode("distance")}
              >
                Distance
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`px-3 rounded-none ${measurementMode === "area" ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" : "hover:bg-primary/90 hover:text-primary-foreground"}`}
                onClick={() => setMeasurementMode("area")}
              >
                Area
              </Button>
            </div>

            <div className="flex-1" />
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                // Add viewport center as measurement point
                addMeasurementPoint(viewportCenter);
              }}
            >
              <PlusIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                clearMeasurements();
              }}
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-4">
              <div className="flex items-center justify-between border rounded-md p-3 bg-muted/10">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">
                    {measurementMode === "distance" ? "Distance" : "Area"}
                  </div>
                  <div className="text-xl font-semibold">
                    {currentMeasurement !== null ? formatMeasurement(currentMeasurement) : '0'}
                  </div>
                </div>
              </div>


            </div>
          
        </div>
      </div>
    </Card>
  );
}

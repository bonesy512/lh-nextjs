import { Layer, Source } from "react-map-gl";
import { useAppStore } from "@/utils/store";
import * as turf from "@turf/turf";
import { useEffect, useState } from "react";

// No props needed anymore as we use store

export function MeasurementLayer() {
  const {
    measurementMode,
    measurementPoints,
    setCurrentMeasurement,
    addMeasurementPoint,
    viewportCenter
  } = useAppStore();

  // Generate GeoJSON for visualization
  const getGeoJSON = () => {
    if (!measurementPoints || !Array.isArray(measurementPoints)) return null;
    if (measurementPoints.length === 0 && measurementMode === 'none') return null;

    // Create point features for all measurement points
    const pointFeatures = measurementPoints.map((point) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: point,
      },
      properties: {},
    }));

    let mainFeature;
    if (measurementMode === "distance") {
      const coordinates = [...measurementPoints];
      coordinates.push(viewportCenter);

      mainFeature = {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates,
        },
        properties: {},
      };
    } else if (measurementMode === "area") {
      const coordinates = [...measurementPoints];
      if (coordinates.length > 0) {
        coordinates.push(viewportCenter);
      }

      // If we have less than 3 points, show a LineString
      if (coordinates.length < 3) {
        mainFeature = {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates,
          },
          properties: {},
        };
      } else {
        // If we have 3 or more points, show a Polygon
        const polygonCoordinates = [...coordinates];
        polygonCoordinates.push(polygonCoordinates[0]); // Close the polygon

        mainFeature = {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [polygonCoordinates],
          },
          properties: {},
        };
      }
    }

    // Only include mainFeature if it exists
    if (!mainFeature) {
      return {
        type: "FeatureCollection",
        features: pointFeatures,
      };
    }

    return {
      type: "FeatureCollection",
      features: [...pointFeatures, mainFeature],
    };
  };

  // Calculate measurement
  useEffect(() => {
    const geojson = getGeoJSON();
    if (!geojson || !geojson.features || geojson.features.length === 0) {
      setCurrentMeasurement(null);
      return;
    }

    let measurement: number | null = null;
    // Get the main feature (last feature in the array)
    const mainFeature = geojson.features[geojson.features.length - 1];

    if (measurementMode === "distance" && mainFeature.geometry.type === "LineString") {
      measurement = turf.length(mainFeature, { units: "miles" });
    } else if (
      measurementMode === "area" &&
      mainFeature.geometry.type === "Polygon" &&
      mainFeature.geometry.coordinates[0]?.length >= 4
    ) {
      measurement = turf.area(mainFeature) * 0.000247105; // Convert to acres
    }

    setCurrentMeasurement(measurement);
  }, [measurementPoints, viewportCenter, measurementMode]);

  const geojson = getGeoJSON();
  if (!geojson) return null;

  return (
    <Source id="measurement" type="geojson" data={geojson}>
      {/* Line or polygon fill */}
      {/* Line or polygon fill */}
      <Layer
        id="measurement-fill"
        type={measurementMode === "distance" || (measurementMode === "area" && (!measurementPoints || measurementPoints.length < 3)) ? "line" : "fill"}
        paint={{
          ...(measurementMode === "distance" || (measurementMode === "area" && (!measurementPoints || measurementPoints.length < 3))
            ? {
                "line-color": "#ff0000",
                "line-width": 2,
              }
            : {
                "fill-color": "#ff0000",
                "fill-opacity": 0.2,
              }),
        }}
      />

      {/* Polygon outline for area mode */}
      {measurementMode === "area" && measurementPoints && measurementPoints.length >= 3 && (
        <Layer
          id="measurement-outline"
          type="line"
          paint={{
            "line-color": "#ff0000",
            "line-width": 2,
          }}
        />
      )}

      {/* Points */}
      <Layer
        id="measurement-points"
        type="circle"
        source="measurement"
        paint={{
          "circle-radius": 6,
          "circle-color": "#10b981", // Match primary green color
          "circle-stroke-width": 2,
          "circle-stroke-color": "#FFFFFF",
          "circle-opacity": 0.9,
        }}
        // Only show Point features
        filter={["==", ["geometry-type"], "Point"]}
      />
    </Source>
  );
}

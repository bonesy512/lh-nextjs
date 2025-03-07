import ReactMapGL, { NavigationControl, GeolocateControl, Marker, Source, Layer } from "react-map-gl";
import { MeasurementLayer } from "./MeasurementLayer";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import * as turf from "@turf/turf";
import { MeasurementControls } from "./MeasurementControls";
import { MeasurementCard } from "./MeasurementCard";
import type { LayerProps } from "react-map-gl";
import React from 'react';
import { useAppStore } from "@/utils/store";
import { Skeleton } from "@/components/ui/skeleton";

import "mapbox-gl/dist/mapbox-gl.css";
import { useState, useEffect, useCallback, useRef } from "react";
import brain from "brain";
import { GetConfigData, PropertyDetailsResponse } from "types";

export interface Props {
  onSelectProperty?: (property: any) => void;
  mapRef?: React.MutableRefObject<mapboxgl.Map | undefined>;
}



// Custom control for MapboxDraw
interface DrawControlProps {
  displayControlsDefault: boolean;
  controls: {
    point: boolean;
    line_string: boolean;
    polygon: boolean;
    trash: boolean;
  };
  defaultMode?: string;
  onCreate?: (e: { features: any[] }) => void;
  onUpdate?: (e: { features: any[] }) => void;
  onDelete?: () => void;
  drawRef: React.MutableRefObject<MapboxDraw | undefined>;
}

function DrawControl(props: DrawControlProps) {
  const drawInstance = useRef<MapboxDraw>();

  useControl<MapboxDraw>(
    () => {
      const draw = new MapboxDraw({
        displayControlsDefault: props.displayControlsDefault,
        controls: props.controls,
        defaultMode: props.defaultMode
      });
      drawInstance.current = draw;
      props.drawRef.current = draw;
      return draw;
    },
    ({ map }) => {
      map.on('draw.create', props.onCreate);
      map.on('draw.update', props.onUpdate);
      map.on('draw.delete', props.onDelete);
    },
    ({ map }) => {
      map.off('draw.create', props.onCreate);
      map.off('draw.update', props.onUpdate);
      map.off('draw.delete', props.onDelete);
    }
  );
  return null;
}

export function MapView({ mapRef: externalMapRef }: Props) {

  // Ref for the draw control instance
  const drawRef = useRef<MapboxDraw>();

  const { 
    selectedProperty, 
    setSelectedProperty, 
    setIsLoadingProperty, 
    setIsStyleLoading, 
    isStyleLoading, 
    shouldCenterMap, 
    setShouldCenterMap = () => {},
    measurementMode,
    setMeasurementMode,
    addMeasurement,
    clearMeasurements,
    addMeasurementPoint,
    setViewportCenter
  } = useAppStore();
  const [currentMeasurement, setCurrentMeasurement] = useState<number | null>(null);
  const [hasInitialPosition, setHasInitialPosition] = useState(false);
  const [viewState, setViewState] = useState({
    longitude: -96.7970,
    latitude: 32.7767,
    zoom: 14,
    pitch: 0,
    bearing: 0
  });
  // Get user's location on mount
  useEffect(() => {
    if (!hasInitialPosition && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setViewState(prev => ({
            ...prev,
            longitude: position.coords.longitude,
            latitude: position.coords.latitude,
            zoom: 14
          }));
          setHasInitialPosition(true);
        },
        (error) => {
          console.warn('Geolocation error:', error.message);
          setHasInitialPosition(true); // Mark as handled even if it failed
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    }
  }, [hasInitialPosition]);

  const MAPBOX_TOKEN = "pk.eyJ1IjoidGludGluMTIzNCIsImEiOiJjbTRpbDNlMWMwMm83MmtzaWdncTNoZWt2In0.ZoyxSZXBSe21POwTspaL9w";
  const mapStyle = useAppStore(state => state.mapStyle);

  const buildMapboxUrl = (base: string, params: Record<string, string>) => {
    const searchParams = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      ...params
    });
    return `${base}?${searchParams.toString()}`;
  };

  const handleReverseGeocode = async (latitude: number, longitude: number) => {

    
    try {
      const url = buildMapboxUrl(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json`,
        {
          types: 'address,place,locality,neighborhood',
          limit: '1',
          country: 'us',
        }
      );
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Mapbox API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (!data?.features?.length) {
        console.log('No features found in response');
        return null;
      }      
      const feature = data.features[0];
      return {
        streetAddress: feature.place_name || feature.text,
        city: feature.context?.find(ctx => ctx.id.startsWith('place.'))?.text || '',
        state: feature.context?.find(ctx => ctx.id.startsWith('region.'))?.text || '',
        zipcode: feature.context?.find(ctx => ctx.id.startsWith('postcode.'))?.text || ''
      };
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      return null;
    }
  };



  const [selectedPropId, setSelectedPropId] = useState<string | null>(null);
  const [hoveredPropId, setHoveredPropId] = useState<string | null>(null);

  const internalMapRef = useRef<any>();
  const mapRef = externalMapRef || internalMapRef;
  const moveTimeoutRef = useRef<NodeJS.Timeout>();
  const requestIdCounter = useRef<number>(0);

  // Update hoveredPropId when moving over properties
  const updateHoveredPropId = () => {
    // Don't select properties while in measurement mode or if map is not ready
    if (measurementMode !== 'none' || !mapRef.current) {
      setHoveredPropId(null);
      return;
    }
    
    // Check if the layer exists before querying
    const style = mapRef.current.getStyle();
    if (!style.layers?.some(layer => layer.id === 'layer')) {
      return;
    }
    
    try {
      const center = mapRef.current.project([viewState.longitude, viewState.latitude]);
      const features = mapRef.current.queryRenderedFeatures(center, {
        layers: ['layer']
      });

      if (features.length > 0) {
        const feature = features[0];
        const newHoveredId = feature.properties?.Prop_ID ?? null;
        setHoveredPropId(newHoveredId);
        // Clear selection when hovering over a different property
        if (newHoveredId !== selectedPropId) {
          setSelectedPropId(null);
        }
      } else {
        setHoveredPropId(null);
        setSelectedPropId(null);
      }
    } catch (error) {
      console.error('Error querying features:', error);
      setSelectedPropId(null);
    }
  };

  // Fetch property details with abort controller
  const fetchPropertyDetails = async (latitude: number, longitude: number, feature: any, centerMap: boolean = false) => {
    // Don't select new properties while in measurement mode
    if (measurementMode !== 'none') {
      return;
    }
    // Increment and capture the current request ID
    const currentRequestId = ++requestIdCounter.current;
    
    // Only set loading if this is still the latest request
    if (currentRequestId === requestIdCounter.current) {
      setIsLoadingProperty(true);
    }

    try {
      // Set the selected property ID for highlighting if this is still the latest request
      const properties = feature?.properties;
      if (currentRequestId === requestIdCounter.current) {
        setSelectedPropId(properties?.Prop_ID ?? null);
      }

      // Get address from SITUS fields, MAIL fields, or reverse geocoding (in that order)
      let address;
      if (properties?.SITUS_NUM && properties?.SITUS_ST_1) {
        // First try: Use SITUS fields (property location)
        address = {
          streetAddress: `${properties.SITUS_NUM} ${properties.SITUS_ST_1}`,
          city: properties.SITUS_CITY || '',
          state: properties.SITUS_STAT || '',
          zipcode: properties.SITUS_ZIP || ''
        };
      } else if (properties?.MAIL_LINE2) {
        // Second try: Use MAIL fields (mailing address)
        address = {
          streetAddress: properties.MAIL_LINE2,
          city: properties.MAIL_CITY || '',
          state: properties.MAIL_STAT || '',
          zipcode: properties.MAIL_ZIP || ''
        };
      } else {
        // Last resort: Use reverse geocoding
        address = await handleReverseGeocode(latitude, longitude);
        if (!address) {
          if (currentRequestId === requestIdCounter.current) {
            setIsLoadingProperty(false);
          }
          return;
        }
      }

      // Set property data from layer
      const propertyData = {
        zpid: properties?.Prop_ID ? parseInt(properties.Prop_ID) : Date.now(),
        address,
        latitude,
        longitude,
        propertyId: properties?.Prop_ID,
        ownerName: properties?.NAME_CARE ? `${properties.OWNER_NAME} ${properties.NAME_CARE}` : properties?.OWNER_NAME,
        legalAreaUnits: properties?.LGL_AREA_U,
        gisArea: properties?.GIS_AREA ? parseFloat(properties.GIS_AREA) : undefined,
        gisAreaUnits: properties?.GIS_AREA_U,
        landValue: properties?.LAND_VALUE ? parseInt(properties.LAND_VALUE) : undefined,
        improvementValue: properties?.IMP_VALUE ? parseInt(properties.IMP_VALUE) : undefined,
        marketValue: properties?.MKT_VALUE ? parseInt(properties.MKT_VALUE) : undefined,
        dateAcquired: properties?.DATE_ACQ ? parseInt(properties.DATE_ACQ) : undefined,
        fipsCode: properties?.FIPS,
        county: properties?.COUNTY,
        taxYear: properties?.TAX_YEAR ? parseInt(properties.TAX_YEAR) : undefined
      };

      // Only update state if this is still the latest request
      if (currentRequestId === requestIdCounter.current) {
        setShouldCenterMap(centerMap);
        setSelectedProperty(propertyData);
      }
    } catch (error) {
      console.error('Error fetching property details:', error);
    } finally {
      // Only update loading state if this is still the latest request
      if (currentRequestId === requestIdCounter.current) {
        setIsLoadingProperty(false);
      }
    }
  };

  // Handle viewport changes
  const handleViewportChange = async (newViewState: any) => {
    setViewState(newViewState);
    
    // Only update selection when not in measurement mode
    if (measurementMode !== 'none') {
      return;
    } else {
      
    }
    
    // Update hoveredPropId
    // updateHoveredPropId();
    
    // Clear existing timeout
    if (moveTimeoutRef.current) {
      clearTimeout(moveTimeoutRef.current);
    }

    // Set new timeout for 1 second after last movement
    moveTimeoutRef.current = setTimeout(async () => {
      // Check for features at the center of the map
      if (!mapRef.current) return;
      
      const center = mapRef.current.project([newViewState.longitude, newViewState.latitude]);
      const features = mapRef.current.queryRenderedFeatures(center, {
        layers: ['layer']
      });

      if (features.length > 0) {
        const feature = features[0];
        const newPropId = feature.properties?.Prop_ID;
        
        // Only fetch details if it's a different parcel than the one we have loaded
        if (newPropId !== selectedProperty?.propertyId) {
          // When hovering (moving the map), don't pan to location
          fetchPropertyDetails(newViewState.latitude, newViewState.longitude, feature, false);
        }
      }
    }, 200); // 1 second delay
  };


  // Pan to selected property and update selectedPropId when it changes
  useEffect(() => {
    if (selectedProperty) {
      // Update selectedPropId if propertyId exists
      if (selectedProperty.propertyId) {
        setSelectedPropId(selectedProperty.propertyId);
      }
      
      // Pan to property location if coordinates exist and shouldCenterMap is true
      if (shouldCenterMap && selectedProperty.latitude && selectedProperty.longitude) {
        setViewState(prevState => ({
          ...prevState,
          longitude: selectedProperty.longitude,
          latitude: selectedProperty.latitude,
          zoom: 16 // Increased zoom level when panning to property
        }));
      }
    }
  }, [selectedProperty]);

  useEffect(() => {
    setIsStyleLoading(true);
  }, [mapStyle, setIsStyleLoading])

  const handleDrawCreate = useCallback((e: { features: any[] }) => {
    const feature = e.features[0];
    let measurement: number;
    let coordinates: number[][];

    if (feature.geometry.type === 'LineString') {
      measurement = turf.length(feature, { units: 'miles' }); // Distance in miles
      coordinates = feature.geometry.coordinates;
    } else if (feature.geometry.type === 'Polygon') {
      // turf.area returns square meters, convert to acres
      measurement = turf.area(feature) * 0.000247105; // 1 sq meter = 0.000247105 acres
      coordinates = feature.geometry.coordinates[0]; // Outer ring
    } else {
      return;
    }

    setCurrentMeasurement(measurement);
    addMeasurement({
      id: feature.id,
      type: feature.geometry.type === 'LineString' ? 'distance' : 'area',
      value: measurement,
      coordinates
    });
  }, [addMeasurement]);

  const handleDrawUpdate = useCallback((e: { features: any[] }) => {
    handleDrawCreate(e); // Reuse the create handler
  }, [handleDrawCreate]);

  // Update draw mode when measurement mode changes
  useEffect(() => {
    if (drawRef.current && measurementMode !== 'none') {
      drawRef.current.changeMode(
        measurementMode === 'distance' ? 'draw_line_string' : 'draw_polygon'
      );
    }
  }, [measurementMode]);

  const handleDrawDelete = useCallback(() => {
    setCurrentMeasurement(null);
    clearMeasurements();
  }, [clearMeasurements]);



  return (
    <div className="relative w-full h-full">


      {/* Measurement Controls */}
      <div className="absolute bottom-[175px] left-2.5 z-[1]">
        <MeasurementControls />
      </div>
      {measurementMode !== 'none' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl pl-8 z-[2]">
          <MeasurementCard />
        </div>
      )}

      <ReactMapGL
      {...viewState}
      onMove={evt => {
        setViewState(evt.viewState);
        setViewportCenter([evt.viewState.longitude, evt.viewState.latitude]);
        updateHoveredPropId();
      }}

      onClick={evt => {
        if (measurementMode === 'none' && mapRef.current) {
          // Only handle property selection when not in measurement mode
          const features = mapRef.current.queryRenderedFeatures(evt.point, {
            layers: ['layer']
          });
          if (features.length > 0) {
            const feature = features[0];
            fetchPropertyDetails(evt.lngLat.lat, evt.lngLat.lng, feature, true);
          }
        }
      }}
      onMoveEnd={evt => handleViewportChange(evt.viewState)} 

      initialViewState={{
        longitude: -96.7970,
        latitude: 32.7767,
        zoom: 14,
        pitch: 0,
      }}
      style={{ width: "100%", height: "100%" }}
      mapStyle={mapStyle === "custom" ? "mapbox://styles/tintin1234/cm5x2775i00hf01sbewoxfwe6" : "mapbox://styles/tintin1234/cm67i0t9c005u01s70btn35iu"}
      terrain={{ source: "mapbox-dem", exaggeration: 1.2 }}
      maxPitch={60}
      minZoom={2}
      maxZoom={18}

      fog={{
        range: [0.5, 10],
        color: "#242424",
        "horizon-blend": 0.2
      }}

      mapboxAccessToken={MAPBOX_TOKEN}
      // onClick is handled by the onClick prop above
      ref={(ref) => {
        if (ref) {
          mapRef.current = ref.getMap();
        }
      }}
      onLoad={(event) => {
        // Print all available layers
        if (mapRef.current) {
          const style = mapRef.current.getStyle();
        }

        // Mark the style as loaded
        setIsStyleLoading(false);

        // Also listen to "style.load" in case it fires after onLoad:
        // @ts-ignore - event.target exists but TypeScript doesn't recognize it
        event.target.on("style.load", () => {
          setIsStyleLoading(false);
        });

        // Listen for error
        // @ts-ignore - event.target exists but TypeScript doesn't recognize it
        event.target.on('error', (e) => {
          console.error('Mapbox error:', e);
        });
      }}
    >
      {/* Measurement Layer */}
      {measurementMode !== 'none' && (
        <MeasurementLayer />
      )}

      {/* Crosshair overlay */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
        <div className="w-6 h-6 flex items-center justify-center">
          <div className={`w-0.5 h-6 absolute ${mapStyle === "custom" ? "bg-white" : "bg-black"}`}></div>
          <div className={`w-6 h-0.5 absolute ${mapStyle === "custom" ? "bg-white" : "bg-black"}`}></div>
        </div>
      </div>

      <NavigationControl position="bottom-left" showCompass={true} showZoom={true} visualizePitch={true} />
      <GeolocateControl
        position="bottom-left"
        positionOptions={{ enableHighAccuracy: true }}
        trackUserLocation={true}
        showUserHeading={true}
        showAccuracyCircle={true}
      />
      
      {/* Add terrain source */}
      <Source
        id="mapbox-dem"
        type="raster-dem"
        url="mapbox://mapbox.mapbox-terrain-dem-v1"
        tileSize={512}
        maxzoom={16}
      />

      {!isStyleLoading && (
        <>
      {/* Add custom layer for buildings */}
      <Source 
        id="composite1" 
        type="vector" 
        url="mapbox://tintin1234.landglide"
        maxzoom={18}
        minzoom={10}
      >
        {/* Base layer for all parcels */}
        {/* <Layer
          id="layer"
          type="fill"
          source="composite1"
          source-layer="layer"
          paint={{
            "fill-color": "#ffffff",
            "fill-opacity": [
              "case",
              ["==", ["get", "Prop_ID"], hoveredPropId],
              0.3,
              0.1
            ]
          }}
          layout={{
            "visibility": "visible"
          }}
        /> */}

        {/* Highlight layer for selected or hovered parcel */}
        {(selectedPropId || hoveredPropId) && (
          <Layer
            id="selected-outline"
            type="line"
            source="composite1"
            source-layer="layer"
            filter={measurementMode === 'none' ? 
              ["any",
                ["==", ["get", "Prop_ID"], hoveredPropId],
                ["==", ["get", "Prop_ID"], selectedPropId]
              ] :
              ["==", ["get", "Prop_ID"], selectedPropId]
            }
            paint={{
              "line-color": "#0066FF",
              "line-width": 3
            }}
            layout={{
              "visibility": "visible"
            }}
          />
        )}

      </Source>

      </>
      )}
       {/* Show selected location with red marker only when shouldCenterMap is true */}
      {/* {shouldCenterMap && selectedProperty && selectedProperty.latitude && selectedProperty.longitude && (
        <Marker
          longitude={selectedProperty.longitude}
          latitude={selectedProperty.latitude}
          color="#FF0000"
          scale={1.5}
          style={{
            cursor: 'pointer',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
          }}
        />
      )} */}



    </ReactMapGL>
    </div>
  );
}

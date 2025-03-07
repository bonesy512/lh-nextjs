import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useAppStore } from "@/utils/store";
import brain from "brain";
import { useState, useEffect, useRef } from "react";
import { GetConfigData, PropertySearchResult } from "types";

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface GeocodingFeature {
  id: string;
  type: string;
  place_type: string[];
  relevance: number;
  properties: {
    accuracy?: string;
    address?: string;
    category?: string;
    maki?: string;
  };
  text: string;
  place_name: string;
  center: [number, number];
  geometry: {
    type: string;
    coordinates: [number, number];
  };
  context?: Array<{
    id: string;
    text: string;
  }>;
}

interface GeocodingResponse {
  type: string;
  query: string[];
  features: GeocodingFeature[];
  attribution: string;
}

export interface Props {
  onSearch?: (query: string) => void;
  mapRef?: React.RefObject<mapboxgl.Map>;
}

export function SearchBar({ onSearch, mapRef }: Props) {
  const [focused, setFocused] = useState(false);
  const { setSelectedProperty, setIsLoadingProperty, setShouldCenterMap } = useAppStore();
  const [searchResults, setSearchResults] = useState<PropertySearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const [query, setQuery] = useState("");
  const searchTimeout = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    // Only show loading state if query is long enough
    if (query.length >= 2) {
      setLoading(true);
    }

    // Clear previous timeout
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    // Set new timeout for 500ms for better responsiveness
    searchTimeout.current = setTimeout(() => {
      handleSearch(query);
    }, 500);

    // Cleanup timeout on unmount or when query changes
    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [query]);

  const isCoordinates = (query: string): Coordinates | null => {
    // Match patterns like "40.7128,-74.0060" or "40.7128, -74.0060"
    const coordPattern = /^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/;
    const match = query.match(coordPattern);
    
    if (match) {
      const latitude = parseFloat(match[1]);
      const longitude = parseFloat(match[2]);
      
      // Basic validation of coordinates
      if (latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
        return { latitude, longitude };
      }
    }
    
    return null;
  };

  const buildMapboxUrl = (base: string, params: Record<string, string>) => {
    const searchParams = new URLSearchParams({
      access_token: "pk.eyJ1IjoidGludGluMTIzNCIsImEiOiJjbTRpbDNlMWMwMm83MmtzaWdncTNoZWt2In0.ZoyxSZXBSe21POwTspaL9w",
      ...params
    });
    return `${base}?${searchParams.toString()}`;
  };

  const handleReverseGeocode = async (coords: Coordinates) => {
    console.log('Reverse geocoding coordinates:', coords);    
    setLoading(true);
    try {
      const url = buildMapboxUrl(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${coords.longitude},${coords.latitude}.json`,
        {
          types: 'address,place,locality,neighborhood',
          limit: '5',
          country: 'us',
        }
      );
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Mapbox API error: ${response.status} ${response.statusText}`);
      }

      const data: GeocodingResponse = await response.json();
      console.log('Reverse geocoding response:', data);

      if (!data?.features?.length) {
        console.log('No features found in response');
        setSearchResults([]);
        return;
      }
      
      // Transform Mapbox results to match our app's format
      const transformedResults = data.features.map((feature, index) => ({
        // Generate a temporary ID for Mapbox results
        zpid: `mb_${Date.now()}_${index}`,
        streetAddress: feature.place_name || feature.text,
        city: feature.context?.find(ctx => ctx.id.startsWith('place.'))?.text || '',
        state: feature.context?.find(ctx => ctx.id.startsWith('region.'))?.text || '',
        zipcode: feature.context?.find(ctx => ctx.id.startsWith('postcode.'))?.text || '',
        latitude: coords.latitude,
        longitude: coords.longitude
      }));
      
      setSearchResults(transformedResults);
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    // Don't search if query is too short or no token
    if (query.length < 2) return;
    if (!query) {
      setSearchResults([]);
      return;
    }

    // Check if input is coordinates
    const coords = isCoordinates(query);
    if (coords) {
      await handleReverseGeocode(coords);
      return;
    }

    setLoading(true);
    try {
      const url = buildMapboxUrl(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
        {
          types: 'address,place,locality,neighborhood',
          limit: '5',
          country: 'us',
        }
      );
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Mapbox API error: ${response.status} ${response.statusText}`);
      }

      const data: GeocodingResponse = await response.json();

      if (!data?.features?.length) {
        console.log('No features found in response');
        setSearchResults([]);
        return;
      }
      
      // Transform Mapbox results to match our app's format
      const transformedResults = data.features.map((feature, index) => ({
        // Generate a temporary ID for Mapbox results
        zpid: `mb_${Date.now()}_${index}`,
        streetAddress: feature.place_name || feature.text,
        city: feature.context?.find(ctx => ctx.id.startsWith('place.'))?.text || '',
        state: feature.context?.find(ctx => ctx.id.startsWith('region.'))?.text || '',
        zipcode: feature.context?.find(ctx => ctx.id.startsWith('postcode.'))?.text || '',
        latitude: feature.center[1],
        longitude: feature.center[0]
      }));
      
      setSearchResults(transformedResults);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full">
          <Command className="w-full overflow-hidden rounded-lg" shouldFilter={false}>
            <CommandInput
              placeholder="Search by address"
              value={query}
              onValueChange={setQuery}
              disabled={false}
              className="h-10 bg-background/90 backdrop-blur-sm w-full text-base"
              onFocus={() => setFocused(true)}
              onBlur={() => {
                // Small delay to allow onSelect to fire
                setTimeout(() => setFocused(false), 200);
              }}
            />
            {focused && <CommandList className="max-h-[200px] overflow-y-auto">
              <CommandEmpty>{loading ? 'Searching...' : 'No results found.'}</CommandEmpty>
              <CommandGroup>
                {loading ? (
                  <CommandItem value="loading" disabled>
                    Searching...
                  </CommandItem>
                ) : (searchResults?.length > 0 ? searchResults : []).map((result, idx) => (
                  <CommandItem
                    key={idx}
                    value={result.zpid.toString()}
                    onSelect={() => {
                      setFocused(false);
                      setIsLoadingProperty(true);

                      const address = {
                          streetAddress: result.streetAddress,
                          city: result.city,
                          state: result.state,
                          zipcode: result.zipcode
                        }
                      const latitude = result.latitude
                      const longitude = result.longitude
                      
                      // Always pan to location when selecting from search
                      setShouldCenterMap(true);
                      setSelectedProperty({
                        ...result,
                        address, 
                      });
    
                      // Query map layers for additional data if map is available
                      if (mapRef) {
                        const center = mapRef.current.project([longitude, latitude]);
                        const features = mapRef.current.queryRenderedFeatures(center, {
                          layers: ['layer']
                        });
                        if (features.length > 0) {
                          const feature = features[0];
                          const properties = feature.properties || {};

                          // Combine Mapbox result with layer data
                          setSelectedProperty({
                            ...result,
                            zpid: parseInt(result.zpid.replace('mb_', '')) || Date.now(),
                            address,
                            longitude,
                            latitude,
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
                          });
                        } else {
                          // No layer data found, use just the Mapbox result
                          setSelectedProperty({
                            ...result,
                            zpid: parseInt(result.zpid) || Date.now(),
                            address,
                            longitude,
                            latitude
                          });
                        }
                      } else {
                        // No map reference, use just the Mapbox result
                        setSelectedProperty({
                          ...result,
                          zpid: parseInt(result.zpid) || Date.now(),
                          address,
                          longitude,
                          latitude
                        });
                      }
                      setIsLoadingProperty(false);
                    }}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="font-medium text-base">{result.streetAddress}</div>
                      <div className="text-base text-muted-foreground">
                        {[result.city, result.state, result.zipcode].filter(Boolean).join(', ')}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>}
          </Command>
    </div>
  );
}

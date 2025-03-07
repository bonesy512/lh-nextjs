import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CoinsIcon, Loader2, Check, DollarSign, AlertTriangle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import brain from "brain";
import type { PropertyDetailsResponse } from "types";
import { useAppStore } from "@/utils/store";
import { useUserGuardContext, firebaseApp, APP_BASE_PATH } from "app";
import { savePropertyQuery, decreaseCredits } from "@/utils/firebase";

// Helper functions for price calculations
const calculatePriceStats = (acrePrices: NonNullable<PropertyDetailsResponse['acre_prices']>, currentProperty: any) => {
  if (!acrePrices.length) return null;

  // Calculate price per acre for each property
  const pricesPerAcre = acrePrices
    .filter(p => p.price && p.acre) // Filter out invalid entries
    .map(p => p.price! / p.acre!);

  if (!pricesPerAcre.length) return null;

  // Similarity clustering with a threshold of 25%
  const similarityThreshold = 0.25; // 25% threshold for similarity
  const clusters: number[][] = [];

  // Create a copy of prices for processing
  const remainingPrices = [...pricesPerAcre];
  
  // Build clusters
  while (remainingPrices.length > 0) {
    const currentPrice = remainingPrices.shift()!;
    const currentCluster: number[] = [currentPrice];
    
    // Find all prices within threshold of current price
    for (let i = remainingPrices.length - 1; i >= 0; i--) {
      const price = remainingPrices[i];
      const percentDiff = Math.abs(price - currentPrice) / currentPrice;
      
      if (percentDiff <= similarityThreshold) {
        currentCluster.push(price);
        remainingPrices.splice(i, 1);
      }
    }
    
    clusters.push(currentCluster);
  }
  
  // Calculate current price per acre if market value and GIS area are available
  let currentPricePerAcre: number | null = null;
  let selectedCluster: number[];
  let clusterSelectionReason: string;
  
  if (currentProperty.marketValue && currentProperty.gisArea && currentProperty.gisArea > 0) {
    currentPricePerAcre = currentProperty.marketValue / currentProperty.gisArea;
    
    // Find the cluster with the mean closest to the current price per acre
    let closestCluster = clusters[0];
    let minDifference = Number.MAX_VALUE;
    
    clusters.forEach(cluster => {
      const clusterMean = cluster.reduce((a, b) => a + b, 0) / cluster.length;
      const difference = Math.abs(clusterMean - currentPricePerAcre!);
      
      if (difference < minDifference) {
        minDifference = difference;
        closestCluster = cluster;
      }
    });
    
    selectedCluster = closestCluster;
    clusterSelectionReason = "nearest to property's current value";
  } else {
    // Sort clusters by size (largest first) as fallback
    clusters.sort((a, b) => b.length - a.length);
    selectedCluster = clusters[0];
    clusterSelectionReason = "largest cluster available";
  }
  
  const otherCount = pricesPerAcre.length - selectedCluster.length;
  
  // Calculate statistics using the selected cluster
  const mean = selectedCluster.reduce((a, b) => a + b, 0) / selectedCluster.length;
  const variance = selectedCluster.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / selectedCluster.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean; // Coefficient of variation

  // Additional info about clusters
  const numClusters = clusters.length;
  const clusterSizes = clusters.map(c => c.length).join(', ');

  return {
    mean,
    stdDev,
    cv,
    min: Math.min(...selectedCluster),
    max: Math.max(...selectedCluster),
    count: selectedCluster.length,
    totalCount: pricesPerAcre.length,
    outliers: otherCount,
    numClusters,
    clusterSizes,
    currentPricePerAcre,
    clusterSelectionReason
  };
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);
};

interface PredictedPrice {
  predicted_price: string;
  confidence_score: string;
  reasoning: string;
}

export function GeneratePrice() {
  const { selectedProperty, runningProperties, addRunningProperty, removeRunningProperty, setSelectedProperty, userProfile, isLoadingProfile, initializeUserProfileListener } = useAppStore();
  const { user } = useUserGuardContext();

  const [isGenerating, setIsGenerating] = useState(false);
  // const [isFetchingPrices, setIsFetchingPrices] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  // const [priceEstimates, setPriceEstimates] = useState<FirecrawlPrice[]>([]);
  const [predictedPrice, setPredictedPrice] = useState<PredictedPrice | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [savedDocId, setSavedDocId] = useState<string | null>(null);
  const [acrePrices, setAcrePrices] = useState<PropertyDetailsResponse['acre_prices']>([]);
  const [isFetchingAcrePrices, setIsFetchingAcrePrices] = useState(false);

  // Listen for user profile changes
  useEffect(() => {
    if (!user) return;
    const unsubscribe = initializeUserProfileListener(user.uid);
    return () => unsubscribe();
  }, [user, initializeUserProfileListener]);

  // Initialize state if property has existing price data
  useEffect(() => {

    if (selectedProperty?.acre_prices) {
      setShowAnalysis(true);
      setAcrePrices(selectedProperty.acre_prices);

      if (selectedProperty.predicted_price && selectedProperty.confidence_score && selectedProperty.price_reasoning) {
        setPredictedPrice({
          predicted_price: selectedProperty.predicted_price,
          confidence_score: selectedProperty.confidence_score,
          reasoning: selectedProperty.price_reasoning,
        });
      }
    }
  }, [selectedProperty]);

  if (!selectedProperty?.address) return null;

  const address = `${selectedProperty.address.streetAddress}, ${selectedProperty.address.city}, ${selectedProperty.address.state} ${selectedProperty.address.zipcode}`;
  const isPropertyInProgress = runningProperties.includes(address);

  const handleGenerate = async () => {
    addRunningProperty(address);
    setIsGenerating(true);
    // setIsFetchingPrices(true);
    setShowAnalysis(true);

    let finalAcrePrices = [];

    try {
      // Get acre prices for properties in the area
      setIsFetchingAcrePrices(true);
      if (!selectedProperty.address.zipcode) {
        throw new Error("Missing zip code for property");
      }

      const acrePricesResponse = await brain.get_acres_prices({
        city: selectedProperty.address.city,
        acres: selectedProperty.gisArea || 10, // Use GIS area or default to 10 acres
        zip_code: selectedProperty.address.zipcode
      });
      const acrePricesData = await acrePricesResponse.json();
      setAcrePrices(acrePricesData.prices);
      finalAcrePrices = acrePricesData.prices;
    } catch (error) {
      console.error("Error getting acre prices:", error);
    } finally {
      setIsFetchingAcrePrices(false);
      setIsGenerating(false);
    }

    // Calculate predicted price based on acre prices
    setIsPredicting(true);
    try {
      const stats = calculatePriceStats(finalAcrePrices, selectedProperty);
      
      if (!stats || !selectedProperty.gisArea) {
        throw new Error("Insufficient data for prediction");
      }

      // Calculate predicted price
      const predictedValue = stats.mean * selectedProperty.gisArea;
      
      // Calculate confidence score (0-100)
      // Lower CV = higher confidence
      // CV of 0.5 or higher = 0% confidence
      // CV of 0 = 100% confidence
      const confidence = Math.max(0, Math.min(100, (1 - stats.cv * 2) * 100));
      
      // Generate reasoning
      const clusterBasis = stats.clusterSelectionReason === "largest cluster available" ? 
        "cluster of properties" : 
        "cluster of properties";
      
      const currentValueInfo = stats.currentPricePerAcre ? 
        `\n• Current property value per acre: ${formatCurrency(stats.currentPricePerAcre)}` : "";
      
      const reasoning = `Analysis based on a ${clusterBasis} with characteristics most similar to your property (${stats.count} of ${stats.totalCount} properties) in ${selectedProperty.address.city.toUpperCase()}:  

• Average price per acre: ${formatCurrency(stats.mean)}  
• Range within cluster: ${formatCurrency(stats.min)} to ${formatCurrency(stats.max)} per acre  
• Price variation: ${(stats.cv * 100).toFixed(1)}%  
• Your property: ${selectedProperty.gisArea.toFixed(2)} acres  ${currentValueInfo}
• Outliers excluded: ${stats.outliers} properties  

This estimate uses similarity clustering to group properties with similar prices per acre (within 25% of each other) and selects the most relevant cluster for analysis. The coefficient of variation (${(stats.cv * 100).toFixed(1)}%) indicates the spread of prices within the cluster - a lower percentage suggests more consistent pricing.`;

      setPredictedPrice({
        predicted_price: formatCurrency(predictedValue),
        confidence_score: confidence.toFixed(0),
        reasoning: reasoning
      });
  
      // Update property with prediction and comparisons
      const updatedProperty = {
        ...selectedProperty,
        // priceComparisons: finalPriceEstimates,
        predicted_price: formatCurrency(predictedValue),
        confidence_score: confidence.toFixed(0),
        price_reasoning: reasoning,
        acre_prices: finalAcrePrices,
      };

      // Auto-save the property and decrease credits
      const docId = await savePropertyQuery(user.uid, updatedProperty);
      setSavedDocId(docId);
      await decreaseCredits(user.uid);
      setSelectedProperty(updatedProperty);
    } catch (error) {
      console.error("Error predicting price or saving property:", error);
      // Even if saving fails, update the state
      setSelectedProperty({
        ...selectedProperty,

      });
    } finally {
      setIsPredicting(false);
      removeRunningProperty(address);
    }
  };

  return (
    <div className="space-y-8 w-full max-w-[100%] overflow-hidden">
      {/* Market Value - Only show if exists */}
      {/* {selectedProperty.marketValue && (
        <div className="space-y-4">
          <div className="border rounded-lg shadow-sm bg-card text-card-foreground">
            <div className="flex items-center gap-2 p-4 border-b">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
                <DollarSign className="w-4 h-4" />
              </div>
              <h4 className="text-base font-semibold">Market Value</h4>
            </div>
            <div className="p-6">
              <div className="text-3xl font-bold text-center">
                ${selectedProperty.marketValue.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )} */}

      {/* Land Value - Only show if exists */}
      {/* {selectedProperty.landValue && (
        <div className="space-y-4">
          <div className="border rounded-lg shadow-sm bg-card text-card-foreground">
            <div className="flex items-center gap-2 p-4 border-b">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
                <DollarSign className="w-4 h-4" />
              </div>
              <h4 className="text-base font-semibold">Land Value</h4>
            </div>
            <div className="p-6">
              <div className="text-3xl font-bold text-center">
                ${selectedProperty.landValue.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )} */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Generate Price</h3>
        {!showAnalysis && (
          <div className="flex flex-col items-center gap-4">
            {userProfile?.credits === 0 && (
              <Alert variant="destructive" className="max-w-sm">
                <CoinsIcon className="w-4 h-4" />
                <AlertDescription>
                  You're out of credits. Purchase more credits to continue analyzing properties.
                </AlertDescription>
              </Alert>
            )}
            {userProfile?.credits < 50 ? (
              <Alert variant="warning" className="max-w-sm bg-amber-500/20 text-amber-500 border-amber-500">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  You need at least 50 tokens to generate a price analysis. Please purchase more tokens.
                </AlertDescription>
              </Alert>
            ) : (
              <Button 
                onClick={handleGenerate} 
                disabled={isPropertyInProgress || userProfile?.credits === 0 || isLoadingProfile}
                className="w-full max-w-sm"
              >
                {isPropertyInProgress ? "Generating..." : "Generate"}
              </Button>
            )}
          </div>
        )}
      </div>



      {/* Acre Prices */}
      {showAnalysis && (
        isFetchingAcrePrices ? (
          <div className="border rounded-lg shadow-sm bg-card text-card-foreground">
            <div className="flex items-center gap-2 p-4 border-b">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <h4 className="text-base font-semibold">Loading Comparable Properties</h4>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto w-[min(63vw,400px)]">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-muted-foreground">Address</TableHead>
                      <TableHead className="text-right text-muted-foreground">Size (Acres)</TableHead>
                      <TableHead className="text-right text-muted-foreground">Price (USD)</TableHead>
                      <TableHead className="text-right text-muted-foreground">Price/Acre</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[1, 2, 3].map((_, index) => (
                      <TableRow key={index} className="hover:bg-transparent">
                        <TableCell><Skeleton className="w-48 h-4" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="w-20 h-4 ml-auto" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="w-24 h-4 ml-auto" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="w-24 h-4 ml-auto" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        ) : !acrePrices ? null : acrePrices.length === 0 ? (
          <div className="border rounded-lg shadow-sm bg-card text-card-foreground">
            <div className="flex items-center gap-2 p-4 border-b">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-destructive/10">
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </div>
              <h4 className="text-base font-semibold">No Properties Found</h4>
            </div>
            <div className="p-6">
              <p className="text-sm text-muted-foreground">
                Unable to find properties for sale nearby to estimate price.
              </p>
            </div>
          </div>
        ) : (
          <div className="border rounded-lg shadow-sm bg-card text-card-foreground">
            <div className="flex items-center gap-2 p-4 border-b">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
                <Check className="w-4 h-4" />
              </div>
              <h4 className="text-base font-semibold">Comparable Properties</h4>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto w-[min(63vw,400px)]">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-muted-foreground">Address</TableHead>
                      <TableHead className="text-right text-muted-foreground">Size (Acres)</TableHead>
                      <TableHead className="text-right text-muted-foreground">Price (USD)</TableHead>
                      <TableHead className="text-right text-muted-foreground">Price/Acre</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {acrePrices.map((property, index) => (
                      <TableRow key={index} className="hover:bg-transparent">
                        <TableCell className="font-medium break-words whitespace-normal">
                          {property.address || 'Unknown'}
                        </TableCell>
                        <TableCell className="text-right">
                          {property.acre?.toLocaleString() || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          ${property.price?.toLocaleString() || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {property.acre && property.price
                            ? `$${Math.round(property.price / property.acre).toLocaleString()}`
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )
      )}



      {/* Predicted Price */}
      {showAnalysis && (
        isPredicting || isPropertyInProgress ? (
          <div className="border rounded-lg shadow-sm bg-card text-card-foreground">
            <div className="flex items-center gap-2 p-4 border-b">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <h4 className="text-base font-semibold">Predicting Price</h4>
            </div>
            <div className="p-6">
              <p className="text-sm text-muted-foreground">
                Analyzing market data and comparable properties...
              </p>
            </div>
          </div>
        ) : predictedPrice && (
          <div className="border rounded-lg shadow-sm bg-card text-card-foreground">
            <div className="flex items-center gap-2 p-4 border-b">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
                <DollarSign className="w-4 h-4" />
              </div>
              <h4 className="text-base font-semibold">Predicted Price</h4>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex flex-col items-center gap-2 text-center">
                <span className="text-3xl font-bold">{predictedPrice.predicted_price}</span>
                {/* Confidence score hidden
                <Badge variant={parseFloat(predictedPrice.confidence_score) > 0.7 ? "default" : "secondary"}>
                  {predictedPrice.confidence_score}% confidence
                </Badge>
                */}
              </div>
              <div className="overflow-x-auto overflow-y-visible text-sm prose break-words prose-invert max-w-none">
                <ReactMarkdown>{predictedPrice.reasoning}</ReactMarkdown>
              </div>
            </div>
          </div>
        )
      )}

      {/* Share and Regenerate Buttons */}
      {selectedProperty.predicted_price && !isPropertyInProgress && (
        <div className="flex justify-center gap-4">
          <Button
            variant="outline"
            onClick={handleGenerate}
            disabled={isPropertyInProgress || userProfile?.credits === 0 || userProfile?.credits < 50 || isLoadingProfile}
          >
            {isPropertyInProgress ? "Regenerating..." : "Regenerate"}
          </Button>
          <Button
            onClick={async () => {
              const shareUrl = `${APP_BASE_PATH}?id=${selectedProperty.id}`;
              try {
                await navigator.share({
                  title: 'Landhacker',
                  text: address,
                  url: shareUrl,
                });
              } catch (error: any) {
                console.error('Error sharing:', error);
                // Fallback to copying to clipboard if sharing is not supported
                if (error.name === 'NotSupportedError') {
                  console.log('Share URL:', shareUrl);
                }
              }
            }}
          >
            Share Analysis
          </Button>
        </div>
      )}
    </div>
  );
}
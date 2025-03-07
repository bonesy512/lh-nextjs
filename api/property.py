from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
import databutton as db
import requests
from shapely import wkt
from shapely.geometry import mapping
import json
from app.apis.other_data import get_distance_to_city, DistanceRequest

class Address(BaseModel):
    city: Optional[str] = None
    state: Optional[str] = None
    streetAddress: Optional[str] = None
    zipcode: Optional[str] = None


class AcrePriceData(BaseModel):
    acre: Optional[float] = None
    price: Optional[float] = None
    address: Optional[str] = None

class PriceEstimate(BaseModel):
    url: Optional[str] = None
    price: Optional[str] = None
    website_name: Optional[str] = None

class PropertyDetailsResponse(BaseModel):
    # Metadata
    id: Optional[str] = Field(None, description="Unique identifier for the property")
    isSaved: Optional[bool] = Field(None, description="Whether the property is saved by the user")
    
    # Parcel Data
    propertyId: Optional[str] = Field(None, description="Property ID from county records")
    ownerName: Optional[str] = Field(None, description="Property owner name")
    legalArea: Optional[str] = Field(None, description="Legal area with units")
    legalAreaUnits: Optional[str] = Field(None, description="Legal area units")
    gisArea: Optional[float] = Field(None, description="GIS calculated area")
    gisAreaUnits: Optional[str] = Field(None, description="GIS area units")
    landValue: Optional[int] = Field(None, description="Assessed land value")
    improvementValue: Optional[int] = Field(None, description="Assessed improvement value")
    marketValue: Optional[int] = Field(None, description="Total market value")
    dateAcquired: Optional[int] = Field(None, description="Date property was acquired")
    fipsCode: Optional[str] = Field(None, description="FIPS code")
    county: Optional[str] = Field(None, description="County name")
    taxYear: Optional[int] = Field(None, description="Tax assessment year")
    
    # Address
    address: Address
    zpid: int
 
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    # Distance to City
    timeToCity: Optional[str] = None
    distanceToCity: Optional[str] = None
    
    # Analysis and Comparisons
    priceComparisons: Optional[List[PriceEstimate]] = Field(
        None,
        description="Price estimates from different websites"
    )
    predicted_price: Optional[str] = Field(
        None,
        description="AI predicted price for the property"
    )
    confidence_score: Optional[str] = Field(
        None,
        description="Confidence score for the predicted price (0-1)"
    )
    price_reasoning: Optional[str] = Field(
        None,
        description="Reasoning behind the predicted price"
    )
    
    # Acre Prices
    acre_prices: Optional[List[AcrePriceData]] = Field(
        None,
        description="Comparable land prices by acre in the area"
    )

class PropertySearchResult(BaseModel):
    zpid: str
    streetAddress: str
    city: str
    state: str
    zipcode: str
    latitude: float
    longitude: float

router = APIRouter()






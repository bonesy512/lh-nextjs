from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
import databutton as db
import requests
from openai import OpenAI
from firecrawl import FirecrawlApp

router = APIRouter()

class AcrePriceData(BaseModel):
    acre: float | None = None
    price: float | None = None
    address: str | None = None

class ExtractAcreSchema(BaseModel):
    prices: list[AcrePriceData] | None = None

class AcrePricesRequest(BaseModel):
    city: str
    acres: float
    zip_code: str

class AcrePricesResponse(BaseModel):
    prices: list[AcrePriceData]

class FirecrawlPrice(BaseModel):
    """Base model matching Firecrawl's price extraction schema"""
    url: Optional[str] = None
    price: Optional[str] = None
    website_name: Optional[str] = None

class ScrapingRequest(BaseModel):
    address: str
    city: str
    state: str


def extract_prices_with_firecrawl(urls: List[str], address: str, location_id: str = None) -> Dict:
    """Extract prices from multiple URLs using Firecrawl's extract endpoint
    
    Args:
        urls: List of URLs to extract prices from
        location_id: Optional location ID for logging
    
    Returns:
        Raw response from Firecrawl API
    """
    # Initialize Firecrawl
    app = FirecrawlApp(api_key=db.secrets.get("FIRECRAWL_API_KEY"))
    
    # Define extraction schema
    class ExtractSchema(BaseModel):
        prices: list[FirecrawlPrice]
    
    # Extract prices for all URLs in one call and return raw response
    print("Extracting prices from URLs:", urls)
    try:
        response = app.extract(
            urls,
            {
                'prompt': f'Extract the price of the property with address from the given URL.',
                'schema': ExtractSchema.model_json_schema(),
                "includeSubdomains": False,
                "enableWebSearch": False,
            }
        )
        print("Raw Firecrawl response:", response)
        return response
    except Exception as e:
        print(f"Error in Firecrawl extraction: {e}")
        return {'prices': []}

class PricePredictionRequest(BaseModel):
    address: str
    priceComparisons: list[FirecrawlPrice]

class PricePredictionResponse(BaseModel):
    predicted_price: str
    confidence_score: str  # 0-1 scale
    reasoning: str

@router.post("/scrape/predict-price")
async def predict_price(request: PricePredictionRequest) -> PricePredictionResponse:
    client = OpenAI(api_key=db.secrets.get("DB_OPENAI_API_KEY"))
    
    # Construct the prompt with price comparisons
    prompt = f"""You are a real estate price prediction expert. Based on the following price comparisons, predict the current market value of this property.

Property Location:
{request.address}

Price Comparisons:
{chr(10).join(f"- {comp.website_name or comp.url or 'Unknown'}: {comp.price or 'No price found'}" for comp in request.priceComparisons)}

Please analyze this information and provide:
1. A predicted market value for the property
2. A confidence score (0-1) in your prediction
3. A detailed explanation of your reasoning

Format your response exactly like this example:
Predicted Price: 450000
Confidence: 0.85
Reasoning: Based on the recent comparable sales in the area...

If there are no price comparisons, return a confidence score of 0 and explain why a prediction cannot be made.
"""

    try:
        # Get completion from OpenAI
        completion = client.chat.completions.create(
            model="o3-mini",
            messages=[
                {"role": "system", "content": "You are a real estate valuation expert. Always respond in the exact format specified."},
                {"role": "user", "content": prompt}
            ]
        )
        
        # Parse the response
        response_text = completion.choices[0].message.content
        print("GPT-4 Response:", response_text)
        
        # Extract values from the response
        try:
            lines = response_text.strip().split('\n')
            print("Split lines:", lines)
            
            if len(lines) < 3:
                raise ValueError("Response does not contain enough lines. Got " + str(len(lines)) + " lines, expected at least 3")
            
            # Extract predicted price
            if not lines[0].startswith("Predicted Price:"):
                raise ValueError("First line does not start with 'Predicted Price:'. Got: " + lines[0])
            predicted_price = lines[0].split(': ')[1].strip()
            
            # Extract confidence
            if not lines[1].startswith("Confidence:"):
                raise ValueError(f"Second line does not start with 'Confidence:'. Got: {lines[1]}")
            confidence = lines[1].split(': ')[1].strip()
            
            # Extract reasoning
            reasoning = '\n'.join(lines[2:]).replace('Reasoning: ', '', 1)
            
            print("Parsed values - Price: " + str(predicted_price) + ", Confidence: " + str(confidence))
        except Exception as e:
            print("Error parsing GPT-4 response: " + str(e))
            raise ValueError("Failed to parse GPT-4 response: " + str(e) + ". Full response: " + response_text) from e
        
        return PricePredictionResponse(
            predicted_price=predicted_price,
            confidence_score=confidence,
            reasoning=reasoning
        )
        
    except Exception as e:
        print("Error in price prediction: " + str(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to generate price prediction"
        ) from e

@router.post("/scrape/estimates")
def get_price_estimates(request: ScrapingRequest) -> List[FirecrawlPrice]:
    """Get price estimates from various sources for a property using Firecrawl for extraction"""
    # Generate location ID from address
    location_id = f"{request.address}, {request.city}, {request.state}"
    """Get price estimates from various sources for a property"""
    try:
        # Format address for search
        address = f"{request.address}, {request.city}, {request.state}"

        # Format the search query
        search_query = f"price of {address}"

        # Prepare the API request
        url = "https://api.exa.ai/search"

        payload = {
            "query": search_query,
            "useAutoprompt": True,
            "numResults": 15,
            "contents": {
                "text": True,
            },
        }

        headers = {
            "x-api-key": db.secrets.get("EXA_API_KEY"),
            "Content-Type": "application/json",
        }

        # Make the API request
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()


        # Parse results
        results = response.json()

        # Extract URLs from results
        urls = [result.get("url", "") for result in results.get("results", [])]
        urls = [url for url in urls if url]  # Filter out empty URLs
        urls = urls[:10]  # Limit to 10 URLs for Firecrawl beta
        
        # Extract prices using Firecrawl
        firecrawl_data = extract_prices_with_firecrawl(urls, address, location_id)
        
        # Return Firecrawl prices
        # Handle success/data structure
        if firecrawl_data.get('success'):
            prices_data = firecrawl_data.get('data', {}).get('prices', [])
            print("Firecrawl prices data:", prices_data)
            return [FirecrawlPrice(
                website_name=price_info.get('website_name', 'Unknown'),
                url=price_info.get('url', ''),
                price=price_info.get('price', 'No price found')
            ) for price_info in prices_data]
            # Handle direct prices array
        print("No prices found in Firecrawl response:", firecrawl_data)
        return []

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

@router.post('/scrape/acres-prices')
def get_acres_prices(request: AcrePricesRequest) -> AcrePricesResponse:
    """Get land prices for a specific acre range in a city"""
    try:
        # Initialize Firecrawl
        app = FirecrawlApp(api_key=db.secrets.get("FIRECRAWL_API_KEY"))
        
        # Format city name in different formats
        formatted_city_1 = '_'.join(word.capitalize() for word in request.city.split(' '))
        formatted_city_2 = request.city.replace(' ', '-').lower()
        
        # Capitalize the first letter of each word and join with hyphens
        formatted_city_3 = '-'.join(word.capitalize() for word in request.city.split(' '))
        
        # Generate Trulia URL for land/lots
        urls = [
            f"https://www.trulia.com/TX/{formatted_city_1}/{request.zip_code}/LOT%7CLAND_type/",
            f"https://www.landwatch.com/texas-land-for-sale/{formatted_city_2}/undeveloped-land",
            f"https://www.land.com/{formatted_city_3}-TX/all-land/no-house/for-sale/"
        ]
        
        print(f"Extracting acre prices from URL: {urls}")
        
        # Call Firecrawl with schema
        response = app.extract(
            urls, 
        {
            'prompt': 'From the properties listed, I would need to extract the size and price. ',
            'schema': ExtractAcreSchema.model_json_schema(),
        })
        
        print(f"Firecrawl response: {response}")
        
        # Return extracted prices
        if response and response.get('success') and response.get('data', {}).get('prices'):
            prices_data = response['data']['prices']
            
            # Check if prices is a dictionary with numeric keys and convert to list
            if isinstance(prices_data, dict):
                prices_list = [prices_data[k] for k in prices_data.keys()]
                return AcrePricesResponse(prices=prices_list)
            # If it's already a list, return it directly
            elif isinstance(prices_data, list):
                return AcrePricesResponse(prices=prices_data)
            
        return AcrePricesResponse(prices=[])
        
    except Exception as e:
        print(f"Error getting acre prices: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e

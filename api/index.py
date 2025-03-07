from fastapi import FastAPI

# Import routers
from api.other_data import router as other_data_router
from api.payments import router as payments_router
from api.property import router as property_router
from api.scrape import router as scrape_router

# Initialize FastAPI with custom docs and OpenAPI URLs
app = FastAPI(
    docs_url="/api/py/docs",
    openapi_url="/api/py/openapi.json"
)

# Define the hello-world endpoint
@app.get("/api/py/helloFastApi")
def hello_fast_api():
    return {"message": "Hello from FastAPI"}

# Include routers with their respective prefixes/tags
app.include_router(other_data_router, prefix="/other_data", tags=["other_data"])
app.include_router(payments_router, prefix="/payments", tags=["payments"])
app.include_router(property_router, prefix="/property", tags=["property"])
app.include_router(scrape_router, prefix="/scrape", tags=["scrape"])

# Define the root endpoint ("/")
@app.get("/")
def read_root():
    return {"message": "Landhacker FastAPI is running!"}
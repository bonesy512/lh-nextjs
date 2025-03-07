# api/index.py
from fastapi import FastAPI
from api.other_data import router as other_data_router
from api.payments import router as payments_router
from api.property import router as property_router
from api.scrape import router as scrape_router

app = FastAPI()

app.include_router(other_data_router, prefix="/other_data", tags=["other_data"])
app.include_router(payments_router, prefix="/payments", tags=["payments"])
app.include_router(property_router, prefix="/property", tags=["property"])
app.include_router(scrape_router, prefix="/scrape", tags=["scrape"])

@app.get("/")
def read_root():
    return {"message": "Landhacker FastAPI is running!"}
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.analogs import router as analogs_router
from app.routers.earth_data import router as earth_data_router
from app.routers.location import router as location_router
from app.routers.lunar_data import router as lunar_data_router


# Resolve from this file rather than the process working directory. Existing
# deployment-provided variables take precedence over local development values.
load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)

app = FastAPI(
    title="TerraMatch API",
    description="Scientific Earth Analog Discovery Platform",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
	"http://127.0.0.1:5173",
	"https://terramatch-jfhk.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message": "Welcome to TerraMatch API"
    }


@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "project": "TerraMatch"
    }


app.include_router(location_router)
app.include_router(analogs_router)
app.include_router(earth_data_router)
app.include_router(lunar_data_router)

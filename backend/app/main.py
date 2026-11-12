from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.analogs import router as analogs_router
from app.routers.location import router as location_router

app = FastAPI(
    title="TerraMatch API",
    description="Scientific Earth Analog Discovery Platform",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
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
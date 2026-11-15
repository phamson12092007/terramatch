"""API for acquiring and inspecting real Earth data independently of analog search."""

from fastapi import APIRouter, HTTPException, status

from app.schemas.earth import (
    EarthDataFetchRequest,
    EarthDataStatusResponse,
    EarthLocationRecord,
    ModisTaskResponse,
)
from app.services.earth_data import (
    EarthDataRepository,
    acquire_power_data,
    merge_modis_point_csv,
    merge_srtm_regional_terrain,
    merge_srtm_terrain,
    write_srtm_regional_manifest,
)
from app.services.nasa.modis import ModisAuthenticationError, ModisClient, ModisServiceError
from app.services.nasa.srtm import SrtmAuthenticationError, SrtmClient, SrtmCoverageError, SrtmServiceError
from app.services.nasa.power import PowerServiceError
from app.services.feature_registry import get_all_features


router = APIRouter(prefix="/api/earth", tags=["Earth Open Data"])


@router.get("/features")
def get_earth_feature_catalog():
    """Expose registry metadata alongside repository observation availability.

    This is intentionally read-only: the client can explain what is planned,
    unsupported, or currently observed without duplicating scientific rules.
    """
    repository = EarthDataRepository()
    availability = repository.get_feature_availability_across_locations()
    return {
        "features": [
            {
                **feature.as_dict(),
                "observation_availability": availability.get(feature.key, {}),
            }
            for feature in get_all_features()
        ],
        "repository_diagnostics": repository.get_diagnostics(),
    }


@router.get("/locations", response_model=list[EarthLocationRecord])
def list_earth_locations():
    return EarthDataRepository().list_records()


@router.get("/locations/{location_id}", response_model=EarthLocationRecord)
def get_earth_location(location_id: str):
    return EarthDataRepository().get_record(location_id)


@router.post("/data/fetch", response_model=EarthLocationRecord, status_code=status.HTTP_201_CREATED)
def fetch_earth_data(request: EarthDataFetchRequest):
    try:
        return acquire_power_data(request)
    except PowerServiceError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@router.get("/data/status", response_model=EarthDataStatusResponse)
def get_earth_data_status():
    records = EarthDataRepository().list_records()
    return EarthDataStatusResponse(
        stored_locations=len(records),
        sources=["NASA POWER Daily Point API", "NASA EOSDIS / LP DAAC AppEEARS (MODIS task support)"],
        note="Only successfully retrieved and quality-validated features are stored as REAL. Terrain data are not yet integrated.",
    )


@router.post("/modis/tasks", response_model=ModisTaskResponse, status_code=status.HTTP_202_ACCEPTED)
def submit_modis_task(request: EarthDataFetchRequest):
    try:
        task = ModisClient().submit_point_task(
            location_id=request.location_id,
            latitude=request.latitude,
            longitude=request.longitude,
            start_date=request.start_date,
            end_date=request.end_date,
        )
    except ModisAuthenticationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except ModisServiceError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    task_id = task.get("task_id")
    if not isinstance(task_id, str):
        raise HTTPException(status_code=502, detail="AppEEARS did not return a task ID")
    return ModisTaskResponse(task_id=task_id, status=str(task.get("status", "submitted")), message="MOD11A1.061 task submitted. Poll task status before ingestion.")


@router.get("/modis/tasks/{task_id}", response_model=ModisTaskResponse)
def get_modis_task(task_id: str):
    try:
        task = ModisClient().get_task(task_id)
    except ModisAuthenticationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except ModisServiceError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    return ModisTaskResponse(task_id=task_id, status=str(task.get("status", "unknown")), message=str(task.get("status", "unknown")))


@router.post("/modis/tasks/{task_id}/ingest", response_model=EarthLocationRecord)
def ingest_modis_task(task_id: str, request: EarthDataFetchRequest):
    client = ModisClient()
    try:
        task = client.get_task(task_id)
        if task.get("status") != "done":
            raise HTTPException(status_code=409, detail=f"AppEEARS task is {task.get('status', 'unknown')}, not done")
        bundle = client.get_bundle(task_id)
        files = bundle.get("files", [])
        csv_file = next((file for file in files if str(file.get("file_name", "")).lower().endswith(".csv")), None)
        if not csv_file or not csv_file.get("file_id"):
            raise ModisServiceError("AppEEARS bundle does not contain a CSV point-sample file")
        csv_bytes = client.download_file(task_id, str(csv_file["file_id"]))
        repository = EarthDataRepository()
        try:
            record = repository.get_record(request.location_id)
        except HTTPException as error:
            if error.status_code != 404:
                raise
            from datetime import datetime, timezone
            record = EarthLocationRecord(
                location_id=request.location_id,
                name=request.name,
                country_or_area=request.country_or_area,
                latitude=request.latitude,
                longitude=request.longitude,
                description=request.description,
                data_status="MISSING",
                features=[],
                raw_response_path="",
                retrieved_at=datetime.now(timezone.utc),
            )
        record = merge_modis_point_csv(
            record,
            csv_bytes,
            f"https://appeears.earthdatacloud.nasa.gov/api/bundle/{task_id}/{csv_file['file_id']}",
            request,
        )
        return repository.save(record, {"task": task, "bundle": bundle, "file_name": csv_file["file_name"], "csv": csv_bytes.decode("utf-8-sig")}, provider="modis")
    except HTTPException:
        raise
    except ModisAuthenticationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except (ModisServiceError, ValueError) as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@router.post("/terrain/srtm/{location_id}", response_model=EarthLocationRecord)
def fetch_srtm_terrain(location_id: str):
    repository = EarthDataRepository()
    record = repository.get_record(location_id)
    try:
        result = SrtmClient().fetch_tile(record.latitude, record.longitude)
        enriched = merge_srtm_terrain(record, result)
        raw_hgt_path = repository.save_binary_raw("srtm", location_id, ".hgt", result.raw_bytes)
        return repository.save(
            enriched,
            {"tile": result.tile_name, "source_url": result.source_url, "hgt_path": raw_hgt_path},
            provider="srtm",
        )
    except SrtmCoverageError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except SrtmAuthenticationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except SrtmServiceError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@router.post("/terrain/srtm/{location_id}/regional")
def fetch_srtm_regional_terrain(location_id: str):
    """Fetch and process a Stage 6C regional DEM window without interpolation."""
    repository = EarthDataRepository()
    record = repository.get_record(location_id)
    try:
        result = SrtmClient().fetch_tile(record.latitude, record.longitude)
        raw_hgt_path = repository.save_binary_raw("srtm", location_id, ".hgt", result.raw_bytes)
        enriched, coverage = merge_srtm_regional_terrain(record, result)
        manifest_path = write_srtm_regional_manifest(repository, record, result, raw_hgt_path, coverage)
        if coverage.processing_status != "COVERED":
            return {
                "location_id": location_id,
                "status": "NO_OBSERVATIONS_CREATED",
                "coverage": coverage.__dict__,
                "manifest": manifest_path,
                "reason": "The DEM window did not meet the complete-valid-pixel requirement; no terrain feature was produced.",
            }
        stored = repository.save(
            enriched,
            {"tile": result.tile_name, "source_url": result.source_url, "hgt_path": raw_hgt_path, "manifest": manifest_path},
            provider="srtm",
        )
        return {"location": stored, "coverage": coverage.__dict__, "manifest": manifest_path}
    except SrtmCoverageError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except SrtmAuthenticationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except SrtmServiceError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


from fastapi import APIRouter, HTTPException

from app.schemas.analogs import (
    AnalogSearchRequest,
    AnalogSearchResponse,
)
from app.services.similarity import evaluate_real_earth_analogs, find_simulated_earth_analogs
from app.services.earth_srtm_candidate_index import build_srtm_candidate_index
from app.services.earth_srtm_catalog_ingestion import ingest_earth_terrain_catalog
from app.services.lunar_data import LunarDataRepository
from app.services.nasa.srtm import SrtmAuthenticationError, SrtmCoverageError, SrtmServiceError
from app.site_catalog import validate_catalog_site


router = APIRouter(
    prefix="/api/analogs",
    tags=["Earth Analog Search"],
)


@router.post("/search", response_model=AnalogSearchResponse)
def search_analogs(request: AnalogSearchRequest):
    try:
        validate_catalog_site(
            request.planet,
            request.site_id,
            request.latitude,
            request.longitude,
        )
        if request.earth_data_mode == "REAL_ONLY":
            lunar_target = LunarDataRepository().resolve_real_similarity_targets(
                request.site_id, request.criteria_weights,
            )
            if lunar_target.diagnostics:
                return AnalogSearchResponse(
                    planet=request.planet,
                    target_location={"latitude": request.latitude, "longitude": request.longitude},
                    results=[],
                    data_source="REAL",
                    available_candidate_count=0,
                    skipped_candidate_count=0,
                    scored_candidate_count=0,
                    requested_criteria=lunar_target.diagnostics,
                    candidate_diagnostics=[{
                        "site_id": request.site_id,
                        "name": "Lunar target",
                        "status": "UNSCORED_LUNAR_TARGET",
                        "reason": "The selected Lunar reference data cannot support this REAL_ONLY comparison.",
                        "criteria": lunar_target.diagnostics,
                    }],
                    limitations=[
                        "REAL_ONLY searches resolve Lunar target values from the Lunar reference repository, not client input.",
                        "SAMPLE Lunar observations cannot be used as REAL comparison targets.",
                    ],
                    message="Real-data search was not scored because the selected Lunar target lacks required REAL-backed observations.",
                )
            if request.refresh_from_nasa:
                ingest_earth_terrain_catalog(force_refresh=True)
                build_srtm_candidate_index(force_rebuild=True)
            evaluation = evaluate_real_earth_analogs(
                target_features=lunar_target.target_features,
                criteria_weights=request.criteria_weights,
                top_k=5,
            )
            results = evaluation.results
            data_source = "REAL"
            limitations = [
                "Only scientifically compatible registry features with REAL Earth observations can contribute to a score.",
                "Requested criteria unavailable in the registry or at a location are reported explicitly and never substituted.",
                "Earth analogs are partial analogs and do not reproduce lunar gravity, vacuum, radiation, or atmosphere.",
            ]
            message = (
                f"{'NASA SRTM was refreshed before this search. ' if request.refresh_from_nasa else ''}"
                f"Real-data search completed for {request.research_device}. "
                f"{evaluation.scored_candidate_count} of {evaluation.available_candidate_count} processed Earth records were scored; "
                f"{evaluation.skipped_candidate_count} had no eligible requested criteria."
            )
        else:
            results = find_simulated_earth_analogs(
                target_features=request.target_features.model_dump(),
                criteria_weights=request.criteria_weights,
                top_k=5,
            )
            available_count, skipped_count, data_source = len(results), 0, "SIMULATED"
            limitations = [
                "Demo dataset only: results are not Earth observations and are not mixed with REAL records.",
                "Earth analogs are partial analogs and do not reproduce lunar gravity, vacuum, radiation, or atmosphere.",
            ]
            message = f"Simulated demo search completed for {request.research_device}."

        return AnalogSearchResponse(
            planet=request.planet,
            target_location={
                "latitude": request.latitude,
                "longitude": request.longitude,
            },
            results=results,
            data_source=data_source,
            available_candidate_count=evaluation.available_candidate_count if request.earth_data_mode == "REAL_ONLY" else available_count,
            skipped_candidate_count=evaluation.skipped_candidate_count if request.earth_data_mode == "REAL_ONLY" else skipped_count,
            scored_candidate_count=evaluation.scored_candidate_count if request.earth_data_mode == "REAL_ONLY" else len(results),
            requested_criteria=evaluation.requested_criteria if request.earth_data_mode == "REAL_ONLY" else [],
            candidate_diagnostics=evaluation.candidate_diagnostics if request.earth_data_mode == "REAL_ONLY" else [],
            limitations=limitations,
            message=message,
        )

    except HTTPException:
        raise

    except FileNotFoundError as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        )

    except SrtmAuthenticationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    except (SrtmCoverageError, SrtmServiceError) as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    except ValueError as error:
        raise HTTPException(
            status_code=422,
            detail=str(error),
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        )

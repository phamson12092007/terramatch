# Earth data storage

`earth_analogs.csv` is the legacy simulated dataset used by the current analog
search workflow. It remains separate from NASA-derived records during the
incremental migration.

NASA POWER acquisitions are stored in two layers:

- `raw/power/`: original JSON responses, named with the requested location ID
  and retrieval timestamp.
- `processed/`: one latest normalized record per location ID, with individual
  features, provenance, quality counts, and a relative path to its raw source.

The Stage 2 POWER processor records `T2M`, `T2M_MIN`, `T2M_MAX`, and
`ALLSKY_SFC_SW_DWN`. Temperature features are two-metre **air temperature**
in degrees Celsius; they are not land-surface temperature. The radiation
feature is daily all-sky surface shortwave downward radiation in MJ/m²/day; it
is not terrain illumination, shadow duration, or solar incidence angle.

`REAL` means a feature was successfully retrieved and validated. `PARTIAL`
means some requested features are unavailable, while `MISSING` means none of
the requested values are available. NASA-derived records are not yet used by
the similarity engine; that migration is a later stage.

MODIS requests use the official NASA EOSDIS/LP DAAC AppEEARS point-task API
with `MOD11A1.061`, `LST_Day_1km`, `LST_Night_1km`, `QC_Day`, and `QC_Night`.
They require an `APPEEARS_TOKEN` environment variable; this is deliberately
separate from the `EARTHDATA_TOKEN` used only for protected SRTM downloads.
The task is asynchronous:
submit it, poll its status, then ingest only a completed task. Packed LST values
are multiplied by `0.02` to obtain Kelvin, and only observations where the
mandatory and data-quality QA flags are both `00` are retained.

SRTM terrain uses `SRTMGL1.003` HGT tiles. The legacy processor reads the
native big-endian elevation grid, calculates a central-difference slope and
3×3 roughness window, and rejects tile-edge/void windows rather than
interpolating.

Stage 6C adds a separate regional terrain pipeline for a small catalog of
five fixed Earth query points (Atacama Desert, Death Valley, Amboy Crater,
Mauna Kea, and Wadi Rum). It uses the same four metrics and nominal
9,476.05 m support as the LOLA Stage 6B workflow: relative elevation,
least-squares metric-plane slope, plane-residual roughness, and local relief.
The HGT raster is preserved under `raw/srtm/` but ignored by Git; every run
records its source URL, SHA-256, native/local metric resolution, coverage, and
processing parameters under `manifests/`. The four output observations are
`DERIVED` with `source_data_status: REAL`. Stage 6F enables only relative
local elevation and least-squares regional slope for terrain screening:
both are evaluated over the documented nominal support and are insensitive to
the absolute vertical datum in the case of relative elevation. Roughness and
relief remain visible but excluded from scoring because their values are
resolution-sensitive between LOLA and SRTM.

`earth_srtm_candidate_index.py` expands each downloaded NASA SRTM tile into a
5×5 interior grid of REAL-derived regional terrain samples. The current index
therefore contains 125 additional observation points sourced from the five
archived tiles. A REAL_ONLY search scans every indexed point and returns only
the five highest terrain-screening scores; it does not fill the ranking with
simulated locations.

The analog API has two explicit modes. `REAL_ONLY` ranks only processed records
with `REAL` observations for every selected comparison criterion. It never
falls back to this directory's simulated CSV. `SIMULATED_DEMO` uses only the
legacy CSV so demos remain available without being mixed with NASA records.

# Lunar reference data

`raw/lola/ldem_16.img` is the unmodified NASA PDS LOLA LDEM_16 source raster.
It is deliberately Git-ignored because it is 33 MB; its SHA-256 checksum,
source URL, and PDS3 product metadata are recorded in
`manifests/lola_ingestion_manifest.json`. The small companion PDS3 label is
stored as `raw/lola/ldem_16.lbl`.

`raw/diviner` and `raw/lroc` remain reserved for unchanged future sources.

`raw/diviner/dlre_prp_south.tab` is the unmodified 605 MB NASA PDS LRO
Diviner South Polar Resource Product and is Git-ignored. Its accompanying
PDS3 and PDS4 labels are retained, and its SHA-256, exact source URLs, and
nearest-mesh selection results are recorded in
`manifests/diviner_prp_south_ingestion_manifest.json`. The ingestion appends
only model-derived annual thermal metrics at the nearest archived triangular
mesh element for sites at or south of 80°S. It does not interpolate, treat the
2 cm subsurface annual mean as a surface-temperature measurement, or use these
thermal metrics for Earth similarity scoring.

`processed/sites` contains normalized reference-location records. The records
retain the original TerraMatch development samples, which are explicitly
marked `SAMPLE`. LOLA regional-terrain observations are appended as `DERIVED`
only when a complete valid 5×5 LDEM_16 support window exists, with a REAL
source provenance chain. No original sample is overwritten.

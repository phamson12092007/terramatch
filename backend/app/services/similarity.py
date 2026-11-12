
from pathlib import Path

import numpy as np
import pandas as pd


DATA_PATH = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "earth"
    / "earth_analogs.csv"
)

# Trọng số thử nghiệm, chưa được hiệu chỉnh khoa học.
WEIGHTS = {
    "elevation_m": 0.40,
    "slope_deg": 0.35,
    "surface_temp_k": 0.25,
}

# Thang chuẩn hóa thử nghiệm.
SCALES = {
    "elevation_m": 5000,
    "slope_deg": 45,
    "surface_temp_k": 200,
}


def find_earth_analogs(target_features: dict, top_k: int = 5):
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Earth analog dataset not found: {DATA_PATH}"
        )

    df = pd.read_csv(DATA_PATH)

    required_columns = [
        "elevation_m",
        "slope_deg",
        "surface_temp_k",
    ]

    results = []

    for _, row in df.iterrows():
        weighted_distance = 0.0

        for feature in required_columns:
            target_value = float(target_features[feature])
            earth_value = float(row[feature])

            difference = (
                (earth_value - target_value) / SCALES[feature]
            )

            weighted_distance += (
                WEIGHTS[feature] * difference ** 2
            )

        distance = np.sqrt(weighted_distance)

        similarity_score = max(
            0.0,
            min(100.0, (1.0 - distance) * 100)
        )

        results.append({
            "site_id": row["site_id"],
            "name": row["name"],
            "country": row["country"],
            "latitude": float(row["latitude"]),
            "longitude": float(row["longitude"]),

            "elevation_m": float(row["elevation_m"]),
            "slope_deg": float(row["slope_deg"]),
            "surface_temp_k": float(row["surface_temp_k"]),

            "similarity_score": round(similarity_score, 2),
            "data_status": row["data_status"],
        })

    results.sort(
        key=lambda item: item["similarity_score"],
        reverse=True,
    )

    return results[:top_k]

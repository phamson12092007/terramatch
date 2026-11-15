import { modes, target } from "./data.js";

const gaussian = (value, mean, std) => Math.exp(-((value - mean) ** 2) / (2 * std ** 2));

export function evaluateCandidate(candidate, modeKey) {
  const mode = modes[modeKey];
  if (candidate.ndvi >= 0.22 || candidate.isWater || candidate.isUrban) {
    return { score: 0, rejected: true, rolloverHazard: false, breakdown: {} };
  }

  const metrics = target.metrics;
  const values = {
    slope: gaussian(candidate.slopeDeg, metrics.slope.mean, metrics.slope.std),
    roughness: gaussian(candidate.roughnessTRI, metrics.roughness.mean, metrics.roughness.std),
    geology: gaussian(candidate.maficBrecciaScore, metrics.geology.mean, metrics.geology.std),
    albedoLight: candidate.surfaceAlbedo > 0.25
      ? 0.15
      : gaussian(candidate.surfaceAlbedo, metrics.albedoLight.mean, metrics.albedoLight.std),
    thermalShock: candidate.skinThermalShockC >= 22
      ? 1
      : gaussian(candidate.skinThermalShockC, metrics.thermalShock.mean, metrics.thermalShock.std),
    horizonOcclusion: gaussian(candidate.horizonOcclusionDeg, metrics.horizonOcclusion.mean, metrics.horizonOcclusion.std),
  };

  const weightedTotal = Object.entries(mode.weights)
    .reduce((sum, [key, weight]) => sum + weight * values[key], 0);
  const totalWeight = Object.values(mode.weights).reduce((sum, weight) => sum + weight, 0);
  const weakestCritical = Math.min(...mode.critical.map((key) => values[key]));
  const bottleneck = Math.max(weakestCritical, 0.01) ** 0.25;
  const rolloverHazard = candidate.slopeDeg > 20;
  const rolloverPenalty = rolloverHazard ? 0.65 : 1;

  return {
    score: Math.round((weightedTotal / totalWeight) * bottleneck * rolloverPenalty * 100),
    rejected: false,
    rolloverHazard,
    breakdown: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Math.round(value * 100)])),
  };
}

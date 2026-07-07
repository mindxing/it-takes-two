export const defaultWeightStep = 5;

export function normalizedWeightStep(step: number | null | undefined) {
  return typeof step === "number" && Number.isFinite(step) && step > 0
    ? step
    : defaultWeightStep;
}

export function plannedWeightOffset(weightOffset: number, weightStep: number | null | undefined) {
  if (weightOffset === 0) return 0;

  const step = normalizedWeightStep(weightStep);
  const magnitude = Math.ceil(Math.abs(weightOffset) / step) * step;

  return Math.sign(weightOffset) * magnitude;
}

export function plannedWeight(baseWeight: number, weightOffset: number, weightStep: number | null | undefined) {
  return Math.max(0, baseWeight + plannedWeightOffset(weightOffset, weightStep));
}

function cleanWeight(weight: number) {
  return Math.round(weight * 1000) / 1000;
}

export function progressedWeightIncrease(weight: number, weightStep: number | null | undefined) {
  const step = normalizedWeightStep(weightStep);
  const stepCount = Math.max(1, Math.ceil((weight * 0.05) / step));

  return cleanWeight(weight + stepCount * step);
}

export function progressedWeightDecrease(weight: number, weightStep: number | null | undefined) {
  const step = normalizedWeightStep(weightStep);
  const stepCount = Math.max(1, Math.ceil((weight * 0.05) / step));

  return Math.max(0, cleanWeight(weight - stepCount * step));
}

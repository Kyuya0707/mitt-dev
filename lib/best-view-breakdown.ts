export function getBestViewRevenueBreakdown(viewerPrice: number) {
  const grossAmount = Number.isFinite(viewerPrice)
    ? Math.max(0, Math.trunc(viewerPrice))
    : 0;
  const questionOwnerAmount = Math.floor(grossAmount * 0.5);
  const answerOwnerAmount = Math.floor(grossAmount * 0.2);
  const platformFeeAmount =
    grossAmount - questionOwnerAmount - answerOwnerAmount;

  return {
    grossAmount,
    questionOwnerAmount,
    answerOwnerAmount,
    platformFeeAmount,
  };
}

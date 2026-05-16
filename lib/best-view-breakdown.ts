export function getBestViewRevenueBreakdown(viewerPrice: number) {
  const grossAmount = Number.isFinite(viewerPrice)
    ? Math.max(0, Math.trunc(viewerPrice))
    : 0;
  const questionOwnerAmount = Math.floor(grossAmount * 0.7);
  const platformFeeAmount = grossAmount - questionOwnerAmount;

  return {
    grossAmount,
    questionOwnerAmount,
    answerOwnerAmount: 0,
    platformFeeAmount,
  };
}

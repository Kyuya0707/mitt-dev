export const QUESTION_PLATFORM_FEE_RATE = 0.1;

export function getQuestionRewardBreakdown(rewardAmount: number) {
  const grossAmount = Number.isFinite(rewardAmount)
    ? Math.max(0, Math.trunc(rewardAmount))
    : 0;
  const platformFeeAmount = Math.floor(
    grossAmount * QUESTION_PLATFORM_FEE_RATE
  );
  const answererNetAmount = grossAmount - platformFeeAmount;

  return {
    grossAmount,
    platformFeeAmount,
    answererNetAmount,
    checkoutAmount: grossAmount,
  };
}

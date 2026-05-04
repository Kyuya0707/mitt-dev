import Stripe from "stripe";
import prisma from "@/lib/prisma";

type StripeLikeUser = {
  id: string;
  email?: string | null;
};

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  return new Stripe(key);
}

export function mapStripeAccountToUserUpdate(account: Stripe.Account) {
  return {
    stripeConnectOnboardingCompleted:
      Boolean(account.details_submitted) && Boolean(account.payouts_enabled),
    stripeConnectChargesEnabled: Boolean(account.charges_enabled),
    stripeConnectPayoutsEnabled: Boolean(account.payouts_enabled),
    stripeConnectDetailsSubmitted: Boolean(account.details_submitted),
    stripeConnectRequirementsCurrentlyDue:
      account.requirements?.currently_due ?? [],
    stripeConnectRequirementsEventuallyDue:
      account.requirements?.eventually_due ?? [],
    stripeConnectDisabledReason:
      account.requirements?.disabled_reason ?? null,
  };
}

export async function syncStripeConnectAccountStatusFromAccount(
  userId: string,
  account: Stripe.Account
) {
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      stripeAccountId: account.id,
      ...mapStripeAccountToUserUpdate(account),
    },
    select: {
      id: true,
      stripeAccountId: true,
      stripeConnectOnboardingCompleted: true,
      stripeConnectChargesEnabled: true,
      stripeConnectPayoutsEnabled: true,
      stripeConnectDetailsSubmitted: true,
      stripeConnectRequirementsCurrentlyDue: true,
      stripeConnectRequirementsEventuallyDue: true,
      stripeConnectDisabledReason: true,
    },
  });

  return {
    account,
    user: updatedUser,
  };
}

export async function syncStripeConnectAccountStatus(
  userId: string,
  accountId: string
) {
  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(accountId);
  return syncStripeConnectAccountStatusFromAccount(userId, account);
}

export async function ensureConnectedAccountForUser(user: StripeLikeUser) {
  const existingUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      stripeAccountId: true,
    },
  });

  if (!existingUser) {
    throw new Error("User not found");
  }

  if (existingUser.stripeAccountId) {
    return syncStripeConnectAccountStatus(user.id, existingUser.stripeAccountId);
  }

  const stripe = getStripe();
  const account = await stripe.accounts.create({
    type: "express",
    country: "JP",
    ...(user.email ? { email: user.email } : {}),
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeAccountId: account.id,
    },
  });

  return syncStripeConnectAccountStatus(user.id, account.id);
}

export type GA4CheckoutType =
  | "question_post"
  | "best_view"
  | "negotiation_accept";

export type GA4EventParamsMap = {
  sign_up: { method: "email" };
  answer_posted: { value: 1 };
  begin_checkout: { checkout_type: GA4CheckoutType; amount?: number };
  purchase: {
    purchase_type: GA4CheckoutType;
    value?: number;
    currency?: "JPY";
  };
  best_selected: { value: 1 };
  question_posted: { value: 1; currency?: "JPY" };
};

type GtagFunction = (...args: unknown[]) => void;

const CHECKOUT_AMOUNT_KEY_PREFIX = "ga4_checkout_amount:";
const PURCHASE_SENT_KEY_PREFIX = "ga4_purchase_sent:";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getGtag() {
  if (typeof window === "undefined") {
    return null;
  }

  const gtag = (window as Window & { gtag?: GtagFunction }).gtag;
  return typeof gtag === "function" ? gtag : null;
}

export function trackGA4Event<E extends keyof GA4EventParamsMap>(
  eventName: E,
  params: GA4EventParamsMap[E]
) {
  const gtag = getGtag();
  if (!gtag) {
    return;
  }

  try {
    gtag("event", eventName, params);
  } catch {
    // noop
  }
}

export function rememberCheckoutAmount(
  checkoutType: GA4CheckoutType,
  amount?: number | null
) {
  if (typeof window === "undefined" || !isFiniteNumber(amount)) {
    return;
  }

  try {
    window.sessionStorage.setItem(
      `${CHECKOUT_AMOUNT_KEY_PREFIX}${checkoutType}`,
      String(Math.trunc(amount))
    );
  } catch {
    // noop
  }
}

export function getStoredCheckoutAmount(checkoutType: GA4CheckoutType) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(
      `${CHECKOUT_AMOUNT_KEY_PREFIX}${checkoutType}`
    );
    if (!raw) {
      return null;
    }

    const parsed = Number(raw);
    return isFiniteNumber(parsed) ? Math.trunc(parsed) : null;
  } catch {
    return null;
  }
}

export function trackGA4SignUp() {
  trackGA4Event("sign_up", { method: "email" });
}

export function trackGA4AnswerPosted() {
  trackGA4Event("answer_posted", { value: 1 });
}

export function trackGA4BestSelected() {
  trackGA4Event("best_selected", { value: 1 });
}

export function trackGA4BeginCheckout(input: {
  checkoutType: GA4CheckoutType;
  amount?: number | null;
}) {
  rememberCheckoutAmount(input.checkoutType, input.amount);

  const params: GA4EventParamsMap["begin_checkout"] = {
    checkout_type: input.checkoutType,
  };

  if (isFiniteNumber(input.amount)) {
    params.amount = Math.trunc(input.amount);
  }

  trackGA4Event("begin_checkout", params);
}

export function trackGA4PurchaseOnce(input: {
  purchaseType: GA4CheckoutType;
  sessionId: string;
  fallbackAmount?: number | null;
}) {
  if (typeof window === "undefined" || !input.sessionId) {
    return;
  }

  const sentKey = `${PURCHASE_SENT_KEY_PREFIX}${input.purchaseType}:${input.sessionId}`;

  try {
    if (window.sessionStorage.getItem(sentKey)) {
      return;
    }
  } catch {
    return;
  }

  const amount = getStoredCheckoutAmount(input.purchaseType) ?? input.fallbackAmount;
  const params: GA4EventParamsMap["purchase"] = {
    purchase_type: input.purchaseType,
    currency: "JPY",
  };

  if (isFiniteNumber(amount)) {
    params.value = Math.trunc(amount);
  }

  trackGA4Event("purchase", params);

  try {
    window.sessionStorage.setItem(sentKey, "1");
  } catch {
    // noop
  }
}

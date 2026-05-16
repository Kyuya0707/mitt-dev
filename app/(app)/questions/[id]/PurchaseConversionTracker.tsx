"use client";

import { useEffect } from "react";
import { trackGA4PurchaseOnce, type GA4CheckoutType } from "@/lib/ga";

type PurchaseConversionTrackerProps = {
  shouldTrack: boolean;
  purchaseType: GA4CheckoutType;
  sessionId?: string | null;
  fallbackAmount?: number | null;
};

export default function PurchaseConversionTracker({
  shouldTrack,
  purchaseType,
  sessionId,
  fallbackAmount,
}: PurchaseConversionTrackerProps) {
  useEffect(() => {
    if (!shouldTrack || !sessionId) {
      return;
    }

    trackGA4PurchaseOnce({
      purchaseType,
      sessionId,
      fallbackAmount,
    });
  }, [fallbackAmount, purchaseType, sessionId, shouldTrack]);

  return null;
}

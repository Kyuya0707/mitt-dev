"use client";

import { useEffect } from "react";
import {
  GA4_READY_EVENT,
  trackGA4PurchaseOnce,
  type GA4CheckoutType,
} from "@/lib/ga";

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

    const trackPurchase = () => {
      trackGA4PurchaseOnce({
        purchaseType,
        sessionId,
        fallbackAmount,
      });
    };

    trackPurchase();
    window.addEventListener(GA4_READY_EVENT, trackPurchase);

    return () => {
      window.removeEventListener(GA4_READY_EVENT, trackPurchase);
    };
  }, [fallbackAmount, purchaseType, sessionId, shouldTrack]);

  return null;
}

"use client";

import { useEffect } from "react";

type QuestionPostedConversionTrackerProps = {
  shouldTrack: boolean;
  sessionId?: string | null;
};

type GtagFunction = (...args: unknown[]) => void;

function getGtag() {
  if (typeof window === "undefined") {
    return null;
  }

  const gtag = (window as Window & { gtag?: GtagFunction }).gtag;

  return typeof gtag === "function" ? gtag : null;
}

export default function QuestionPostedConversionTracker({
  shouldTrack,
  sessionId,
}: QuestionPostedConversionTrackerProps) {
  useEffect(() => {
    if (!shouldTrack || !sessionId || typeof window === "undefined") {
      return;
    }

    const storageKey = `ga4_question_posted_${sessionId}`;
    if (window.sessionStorage.getItem(storageKey)) {
      return;
    }

    const gtag = getGtag();
    if (!gtag) {
      return;
    }

    gtag("event", "question_posted", {
      value: 1,
      currency: "JPY",
    });

    window.sessionStorage.setItem(storageKey, "1");
  }, [sessionId, shouldTrack]);

  return null;
}

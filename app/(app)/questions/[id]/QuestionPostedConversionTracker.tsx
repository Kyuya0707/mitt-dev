"use client";

import { useEffect } from "react";
import { GA4_READY_EVENT, trackGA4Event } from "@/lib/ga";

type QuestionPostedConversionTrackerProps = {
  shouldTrack: boolean;
  sessionId?: string | null;
};

export default function QuestionPostedConversionTracker({
  shouldTrack,
  sessionId,
}: QuestionPostedConversionTrackerProps) {
  useEffect(() => {
    if (!shouldTrack || !sessionId || typeof window === "undefined") {
      return;
    }

    const trackQuestionPosted = () => {
      const storageKey = `ga4_question_posted_${sessionId}`;
      if (window.sessionStorage.getItem(storageKey)) {
        return;
      }

      if (
        !trackGA4Event("question_posted", {
          value: 1,
          currency: "JPY",
        })
      ) {
        return;
      }

      window.sessionStorage.setItem(storageKey, "1");
    };

    trackQuestionPosted();
    window.addEventListener(GA4_READY_EVENT, trackQuestionPosted);

    return () => {
      window.removeEventListener(GA4_READY_EVENT, trackQuestionPosted);
    };
  }, [sessionId, shouldTrack]);

  return null;
}

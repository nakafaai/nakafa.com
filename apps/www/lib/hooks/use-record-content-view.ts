"use client";

import { useDocumentVisibility, useIdle, useTimeout } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import { useMutation } from "convex/react";
import { useEffect, useRef } from "react";
import { useContentViews } from "@/lib/context/use-content-views";
import { useUser } from "@/lib/context/use-user";

interface UseRecordContentViewOptions {
  contentType: "article" | "subject" | "exercise";
  slug: string;
  locale: Locale;
  delay?: number;
  idleTimeout?: number;
}

function getDeviceId(): string {
  if (typeof window === "undefined") {
    return "server";
  }

  const key = "nakafa-device-id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

/**
 * Records content views for popularity tracking with smart engagement detection.
 *
 * Features:
 * - useTimeout: Delays recording by specified duration (default 3s engagement)
 * - useIdle: Pauses tracking when user is inactive
 * - useDocumentVisibility: Pauses when tab is hidden
 * - Deduplication: Prevents duplicate views in same session
 *
 * @param contentType - Type of content (article, subject, exercise)
 * @param slug - Unique slug path for the content
 * @param locale - Content locale (e.g., "en", "id")
 * @param delay - Delay in ms before recording view (default: 3000ms)
 * @param idleTimeout - Time in ms before user considered idle (default: 30000ms)
 */
export function useRecordContentView({
  contentType,
  slug,
  locale,
  delay = 3000,
  idleTimeout = 30_000, // 30 seconds of inactivity = idle
}: UseRecordContentViewOptions) {
  const recordView = useMutation(api.contents.mutations.recordContentView);
  const user = useUser((s) => s.user);

  const markAsViewed = useContentViews((s) => s.markAsViewed);
  const isViewed = useContentViews((s) => s.isViewed);
  const startView = useContentViews((s) => s.startView);
  const endView = useContentViews((s) => s.endView);

  // Track if we've already recorded this view
  const hasRecordedRef = useRef(false);

  // Track document visibility (pause when tab hidden)
  const documentState = useDocumentVisibility();
  const isVisible = documentState === "visible";

  // Track user idle state (pause when inactive)
  const isIdle = useIdle(idleTimeout);

  // Setup timer for delayed recording
  const { start, clear } = useTimeout(
    async () => {
      if (hasRecordedRef.current || isViewed(slug)) {
        return;
      }

      const duration = endView(slug);

      try {
        await recordView({
          contentRef: { type: contentType, slug },
          locale,
          deviceId: getDeviceId(),
          userId: user?.appUser._id,
          durationSeconds: duration ?? undefined,
        });
        markAsViewed(slug);
        hasRecordedRef.current = true;
      } catch {
        // Silently fail - view tracking is non-critical
      }
    },
    delay,
    { autoInvoke: false }
  );

  // Start tracking when component mounts
  useEffect(() => {
    if (!(isViewed(slug) || hasRecordedRef.current)) {
      startView(slug);
    }

    return () => {
      // Record duration on unmount if not yet recorded
      if (!(isViewed(slug) || hasRecordedRef.current)) {
        endView(slug);
      }
    };
  }, [slug, isViewed, startView, endView]);

  // Control timer based on visibility and idle state
  useEffect(() => {
    if (isViewed(slug) || hasRecordedRef.current) {
      clear();
      return;
    }

    // Only start timer when: visible AND not idle
    if (isVisible && !isIdle) {
      start();
    } else {
      clear();
    }

    return () => {
      clear();
    };
  }, [isVisible, isIdle, isViewed, slug, start, clear]);
}

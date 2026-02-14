"use client";

import {
  useDocumentVisibility,
  useIdle,
  useLocalStorage,
  useTimeout,
} from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import { generateNanoId } from "@repo/design-system/lib/utils";
import { useMutation } from "convex/react";
import { useEffect } from "react";
import { useContentViews } from "@/lib/context/use-content-views";

interface UseRecordContentViewOptions {
  contentType: "article" | "subject" | "exercise";
  slug: string;
  locale: Locale;
  delay?: number;
  idleTimeout?: number;
}

/**
 * Records content views for popularity tracking with smart engagement detection.
 *
 * Features:
 * - useTimeout: Delays recording by specified duration (default 3s engagement)
 * - useIdle: Pauses tracking when user is inactive
 * - useDocumentVisibility: Pauses when tab is hidden
 * - useLocalStorage: Syncs device ID across browser tabs
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

  const markAsViewed = useContentViews((s) => s.markAsViewed);
  const isViewed = useContentViews((s) => s.isViewed);
  const startView = useContentViews((s) => s.startView);
  const endView = useContentViews((s) => s.endView);

  // Track document visibility (pause when tab hidden)
  const documentState = useDocumentVisibility();
  const isVisible = documentState === "visible";

  // Track user idle state (pause when inactive)
  const isIdle = useIdle(idleTimeout);

  // Device ID with cross-tab synchronization via Mantine useLocalStorage
  const [deviceId] = useLocalStorage({
    key: "nakafa-device-id",
    defaultValue: `${Date.now()}-${generateNanoId(9)}`,
  });

  // Setup timer for delayed recording
  const { start, clear } = useTimeout(
    async () => {
      if (isViewed(slug)) {
        return;
      }

      const duration = endView(slug);

      try {
        await recordView({
          contentRef: { type: contentType, slug },
          locale,
          deviceId,
          durationSeconds: duration ?? undefined,
        });
        markAsViewed(slug);
      } catch {
        // Silently fail - view tracking is non-critical
      }
    },
    delay,
    { autoInvoke: false }
  );

  // Start tracking when component mounts
  useEffect(() => {
    if (!isViewed(slug)) {
      startView(slug);
    }

    return () => {
      // Record duration on unmount if not yet recorded
      if (!isViewed(slug)) {
        endView(slug);
      }
    };
  }, [slug, isViewed, startView, endView]);

  // Control timer based on visibility and idle state
  useEffect(() => {
    if (isViewed(slug)) {
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

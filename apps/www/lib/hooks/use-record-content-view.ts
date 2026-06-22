"use client";

import { useDocumentVisibility, useLocalStorage } from "@mantine/hooks";
import { captureException } from "@repo/analytics/posthog";
import { api } from "@repo/backend/convex/_generated/api";
import type { LearningContextInput } from "@repo/backend/convex/contents/context";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import { generateNanoId } from "@repo/design-system/lib/utils";
import { useMutation } from "convex/react";
import { Effect } from "effect";
import { useEffect, useState } from "react";
import { useContentViews } from "@/lib/context/use-content-views";

/** Client-side graph content-view recording configuration. */
interface UseRecordContentViewOptions {
  contentId?: string | null;
  context?: LearningContextInput;
  delay?: number;
  locale: Locale;
}

/**
 * Records unique content views per user/device when a content identity exists.
 *
 * Design: Backend tracks first and last view timestamps.
 * Local deduplication prevents rapid duplicate calls within session.
 * Uses tab visibility tracking with minimum engagement threshold.
 *
 * @param delay - Minimum engagement time before recording (default: 3000ms)
 */
export function useRecordContentView({
  contentId,
  context,
  locale,
  delay = 3000,
}: UseRecordContentViewOptions) {
  const recordView = useMutation(
    api.contents.mutations.views.recordContentView
  );

  const markAsViewed = useContentViews((s) => s.markAsViewed);
  const isViewed = useContentViews((s) => s.isViewed);

  const documentState = useDocumentVisibility();
  const isVisible = documentState === "visible";
  const viewKey = [
    locale,
    contentId ?? "untracked",
    context?.mode ?? "canonical",
    context?.programKey ?? "",
    context?.nodeKey ?? "",
  ].join(":");
  const [defaultDeviceId] = useState(
    () => `${Date.now()}-${generateNanoId(9)}`
  );
  const [deviceId] = useLocalStorage({
    key: "nakafa-device-id",
    defaultValue: defaultDeviceId,
  });

  useEffect(() => {
    if (!contentId) {
      return;
    }

    if (isViewed(viewKey)) {
      return;
    }

    if (!isVisible) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      Effect.runFork(
        Effect.tryPromise({
          try: () =>
            recordView({
              contentId,
              ...(context ? { context } : {}),
              locale,
              deviceId,
            }),
          catch: (error) => error,
        }).pipe(
          Effect.tap(() => Effect.sync(() => markAsViewed(viewKey))),
          Effect.catchAll((error) =>
            Effect.sync(() =>
              captureException(error, {
                contentId,
                contextMode: context?.mode ?? "canonical",
                locale,
                source: "record-content-view",
              })
            )
          )
        )
      );
    }, delay);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    contentId,
    context,
    delay,
    deviceId,
    isViewed,
    isVisible,
    locale,
    markAsViewed,
    recordView,
    viewKey,
  ]);
}

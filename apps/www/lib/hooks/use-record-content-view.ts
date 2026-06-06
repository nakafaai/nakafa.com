"use client";

import { useDocumentVisibility, useLocalStorage } from "@mantine/hooks";
import { captureException } from "@repo/analytics/posthog";
import { api } from "@repo/backend/convex/_generated/api";
import type {
  ContentViewRef,
  Locale,
} from "@repo/backend/convex/lib/validators/contents";
import { generateNanoId } from "@repo/design-system/lib/utils";
import { useMutation } from "convex/react";
import { Effect } from "effect";
import { useEffect, useState } from "react";
import { useContentViews } from "@/lib/context/use-content-views";

interface UseRecordContentViewOptions {
  contentView: ContentViewRef;
  delay?: number;
  locale: Locale;
}

/**
 * Records unique content views per user/device.
 *
 * Design: Backend tracks first and last view timestamps.
 * Local deduplication prevents rapid duplicate calls within session.
 * Uses tab visibility tracking with minimum engagement threshold.
 *
 * @param delay - Minimum engagement time before recording (default: 3000ms)
 */
export function useRecordContentView({
  contentView,
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
  const viewKey = `${contentView.type}:${locale}:${contentView.slug}`;
  const [defaultDeviceId] = useState(
    () => `${Date.now()}-${generateNanoId(9)}`
  );
  const [deviceId] = useLocalStorage({
    key: "nakafa-device-id",
    defaultValue: defaultDeviceId,
  });

  useEffect(() => {
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
              contentRef: { type: contentView.type, slug: contentView.slug },
              locale,
              deviceId,
            }),
          catch: (error) => error,
        }).pipe(
          Effect.tap(() => Effect.sync(() => markAsViewed(viewKey))),
          Effect.catchAll((error) =>
            Effect.sync(() =>
              captureException(error, {
                locale,
                slug: contentView.slug,
                source: "record-content-view",
                type: contentView.type,
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
    contentView.slug,
    contentView.type,
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

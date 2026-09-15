"use client";

import {
  readLocalStorageValue,
  useDocumentVisibility,
  useLocalStorage,
} from "@mantine/hooks";
import { captureException } from "@repo/analytics/posthog/browser";
import { api } from "@repo/backend/convex/_generated/api";
import type { LearningContextInput } from "@repo/backend/convex/contents/context";
import type { RecordContentViewArgs } from "@repo/backend/convex/contents/views/spec";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import { useConvexAuth, useMutation } from "convex/react";
import { Effect } from "effect";
import { nanoid } from "nanoid";
import { useEffect } from "react";
import { readContentViewErrorCode } from "@/lib/content/views/code";
import { createContentViewKey } from "@/lib/content/views/key";
import { useContentViews } from "@/lib/context/use-content-views";
import { useViewer } from "@/lib/identity/client";

const DEVICE_STORAGE_KEY = "nakafa-device-id";

/** Client-side graph content-view recording configuration. */
interface UseRecordContentViewOptions {
  contentId?: string | null;
  context?: LearningContextInput;
  delay?: number;
  locale: Locale;
  publicPath: string;
  section: RecordContentViewArgs["section"];
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
  publicPath,
  section,
  delay = 3000,
}: UseRecordContentViewOptions) {
  const recordView = useMutation(
    api.contents.mutations.views.recordContentView
  );

  const markAsViewed = useContentViews((s) => s.markAsViewed);
  const isViewed = useContentViews((s) => s.isViewed);
  const { isAuthenticated, isLoading } = useConvexAuth();
  const isUserPending = useViewer((state) => state.isPending);
  const signedInUserId = useViewer((state) => state.viewer?.id ?? null);

  const documentState = useDocumentVisibility();
  const isVisible = documentState === "visible";
  const viewKey = createContentViewKey({
    authenticated: isAuthenticated,
    locale,
    contentId,
    context,
    signedInUserId,
  });
  const [deviceId, setDeviceId] = useLocalStorage({
    key: DEVICE_STORAGE_KEY,
    defaultValue: "",
  });

  useEffect(() => {
    if (!contentId) {
      return;
    }

    if (isLoading || isUserPending) {
      return;
    }

    if (isAuthenticated && !signedInUserId) {
      return;
    }

    if (isViewed(viewKey)) {
      return;
    }

    if (!isVisible) {
      return;
    }

    // Browser identity must not make the surrounding reading page dynamic.
    if (!deviceId) {
      setDeviceId(
        readLocalStorageValue<string>({ key: DEVICE_STORAGE_KEY }) ||
          `${Date.now()}-${nanoid(9)}`
      );
      return;
    }

    const timeoutId = window.setTimeout(() => {
      Effect.runFork(
        Effect.tryPromise(() =>
          recordView({
            contentId,
            ...(context ? { context } : {}),
            locale,
            deviceId,
            publicPath,
            section,
          })
        ).pipe(
          Effect.tap(() => Effect.sync(() => markAsViewed(viewKey))),
          Effect.catchTag("UnknownError", ({ cause: error }) => {
            const errorCode = readContentViewErrorCode(error);

            // A write that never reached Convex carries no code: the browser
            // could not open or keep the socket, which is an expected delivery
            // failure for this best-effort counter. The dedupe key stays unset
            // so the next visit retries, and only typed failures reach
            // operational exceptions with their server code attached.
            if (errorCode === undefined) {
              return Effect.void;
            }

            return Effect.sync(() =>
              captureException(error, {
                contentId,
                contextMode: context?.mode ?? "canonical",
                convex_error_code: errorCode,
                locale,
                source: "record-content-view",
              })
            );
          })
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
    isAuthenticated,
    isLoading,
    isViewed,
    isUserPending,
    isVisible,
    locale,
    markAsViewed,
    publicPath,
    recordView,
    section,
    setDeviceId,
    signedInUserId,
    viewKey,
  ]);
}

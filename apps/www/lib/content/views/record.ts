"use client";

import { useMutation } from "@confect/react";
import { useDocumentVisibility } from "@mantine/hooks";
import { captureException } from "@repo/analytics/posthog/browser";
import refs from "@repo/backend/confect/_generated/refs";
import { learningContextInputValidator } from "@repo/backend/confect/contents/context";
import { contentViewSectionValidator } from "@repo/backend/confect/contents/views/section";
import { localeValidator } from "@repo/backend/confect/lib/validators/contents";
import { Effect, Option, Result, Schema } from "effect";
import { useEffect } from "react";
import { useConvexAuth } from "@/components/providers/convex";
import { useAnalyticsConsent } from "@/lib/analytics/consent/context";
import { useContentViews } from "@/lib/content/views/context";
import {
  readContentViewIdentity,
  resolveContentViewAttribution,
} from "@/lib/content/views/device";
import { createContentViewKey } from "@/lib/content/views/key";
import { useViewer } from "@/lib/identity/client";

/** Client-side graph content-view recording configuration. */
const UseRecordContentViewOptionsSchema = Schema.Struct({
  contentId: Schema.optionalKey(Schema.NullOr(Schema.String)),
  context: Schema.optionalKey(learningContextInputValidator),
  delay: Schema.optionalKey(Schema.Finite),
  locale: localeValidator,
  publicPath: Schema.String,
  section: contentViewSectionValidator,
});
type UseRecordContentViewOptions =
  typeof UseRecordContentViewOptionsSchema.Type;

/**
 * Records unique content views per account or consented device.
 *
 * Design: Backend tracks first and last view timestamps.
 * Local deduplication prevents rapid duplicate calls within session.
 * Uses tab visibility tracking with minimum engagement threshold.
 * The device identifier is created only when a view that analytics consent
 * lets count per device is recorded; see `readContentViewIdentity`.
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
    refs.public.contents.mutations.views.recordContentView
  );

  const markAsViewed = useContentViews((s) => s.markAsViewed);
  const isViewed = useContentViews((s) => s.isViewed);
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const isLoading = useConvexAuth((auth) => auth.isLoading);
  const isUserPending = useViewer((state) => state.isPending);
  const signedInUserId = useViewer((state) => state.viewer?.id ?? null);
  const attribution = useAnalyticsConsent((state) =>
    resolveContentViewAttribution({ isAuthenticated, status: state.status })
  );

  const documentState = useDocumentVisibility();
  const isVisible = documentState === "visible";
  const viewKey = createContentViewKey({
    authenticated: isAuthenticated,
    locale,
    ...(contentId === undefined ? {} : { contentId }),
    ...(context === undefined ? {} : { context }),
    signedInUserId,
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

    // Pending consent cannot tell yet whether the device may count, and a
    // signed-out view without a grant records and stores nothing.
    if (attribution === "pending" || attribution === "none") {
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
        readContentViewIdentity(attribution).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.void,
              onSome: (identity) =>
                Effect.tryPromise(() =>
                  recordView({
                    contentId,
                    ...(context ? { context } : {}),
                    ...identity,
                    locale,
                    publicPath,
                    section,
                  })
                ).pipe(
                  Effect.flatMap((result) =>
                    Result.match(result, {
                      onSuccess: () => Effect.sync(() => markAsViewed(viewKey)),
                      onFailure: (error) =>
                        Effect.sync(() =>
                          captureException(error, {
                            contentId,
                            contextMode: context?.mode ?? "canonical",
                            convex_error_code: error.code,
                            locale,
                            source: "record-content-view",
                          })
                        ),
                    })
                  )
                ),
            })
          ),
          // A transport failure leaves the dedupe key unset for the next visit.
          Effect.catchTag("UnknownError", () => Effect.void)
        )
      );
    }, delay);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    attribution,
    contentId,
    context,
    delay,
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
    signedInUserId,
    viewKey,
  ]);
}

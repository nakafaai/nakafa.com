import { Data, Effect } from "effect";

/** Expected failure while warming the deferred consent preferences surface. */
class ConsentDialogPreloadError extends Data.TaggedError(
  "ConsentDialogPreloadError"
)<{
  readonly cause: unknown;
  readonly message: string;
}> {}

/** Loads the responsive consent surface at the Next.js dynamic boundary. */
export function loadConsentDialog() {
  return import("@repo/design-system/components/ui/responsive-dialog");
}

/** Warms consent preferences on pointer, keyboard, or touch intent. */
export const preloadConsentDialog = Effect.fn(
  "www.analytics.preloadConsentDialog"
)(() =>
  Effect.tryPromise({
    catch: (cause) =>
      new ConsentDialogPreloadError({
        cause,
        message: "Failed to preload analytics consent preferences.",
      }),
    try: loadConsentDialog,
  }).pipe(Effect.ignore)
);

import { Schema } from "effect";

const AnalyticsConsentErrorSchema = Schema.Literals([
  "load",
  "runtime",
  "save",
]);

/** One consent failure kind that the surface names in its message. */
export type AnalyticsConsentError = typeof AnalyticsConsentErrorSchema.Type;

/** Resolves the single surfaced error with load errors winning over retries. */
export function resolveConsentError({
  hasLoadError,
  hasRuntimeError,
  hasSaveError,
}: {
  readonly hasLoadError: boolean;
  readonly hasRuntimeError: boolean;
  readonly hasSaveError: boolean;
}): AnalyticsConsentError | null {
  if (hasLoadError) {
    return "load";
  }
  if (hasSaveError) {
    return "save";
  }
  if (hasRuntimeError) {
    return "runtime";
  }
  return null;
}

/** Resolves whether the current visitor may decline or grant analytics. */
export function resolveConsentAffordances({
  hasBrowserPrivacySignal,
  isAccountResolved,
  isAnonymousResolved,
  isAuthenticated,
  isBlocked,
}: {
  readonly hasBrowserPrivacySignal: boolean;
  readonly isAccountResolved: boolean;
  readonly isAnonymousResolved: boolean;
  readonly isAuthenticated: boolean;
  readonly isBlocked: boolean;
}) {
  const canDecline =
    !isBlocked && (isAuthenticated ? isAccountResolved : isAnonymousResolved);
  return {
    canDecline,
    canGrant: canDecline && !hasBrowserPrivacySignal,
  };
}

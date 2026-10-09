/** Resolves the single surfaced error with load errors winning over retries. */
export function resolveConsentError({
  hasLoadError,
  hasRuntimeError,
  hasSaveError,
}: {
  readonly hasLoadError: boolean;
  readonly hasRuntimeError: boolean;
  readonly hasSaveError: boolean;
}) {
  if (hasLoadError) {
    return "load" as const;
  }
  if (hasSaveError) {
    return "save" as const;
  }
  if (hasRuntimeError) {
    return "runtime" as const;
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

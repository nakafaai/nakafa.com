import {
  ANALYTICS_CONSENT_NOTICE_VERSION,
  type AnalyticsConsentState,
} from "@repo/analytics/consent";

export type AnalyticsConsentPromptIdentity =
  | `account:${string}:${typeof ANALYTICS_CONSENT_NOTICE_VERSION}`
  | `anonymous:${typeof ANALYTICS_CONSENT_NOTICE_VERSION}`;

export type AnalyticsConsentSessionOverride =
  | { readonly owner: symbol; readonly persistence: "pending" }
  | { readonly persistence: "failed" }
  | { readonly decidedAt: number; readonly persistence: "saved" };

export type AnalyticsConsentSessionOverrides = ReadonlyMap<
  AnalyticsConsentPromptIdentity,
  AnalyticsConsentSessionOverride
>;

/** Identifies the current account or anonymous scope and consent notice. */
export function createAnalyticsConsentPromptIdentity({
  isAuthenticated,
  user,
}: {
  readonly isAuthenticated: boolean;
  readonly user: { readonly appUser: { readonly _id: string } } | null;
}): AnalyticsConsentPromptIdentity | null {
  if (!isAuthenticated) {
    return `anonymous:${ANALYTICS_CONSENT_NOTICE_VERSION}`;
  }

  if (!user) {
    return null;
  }

  return `account:${user.appUser._id}:${ANALYTICS_CONSENT_NOTICE_VERSION}`;
}

/** Records one visitor-scoped choice without mutating prior session state. */
export function setAnalyticsConsentSessionOverride({
  override,
  overrides,
  promptIdentity,
}: {
  readonly override: AnalyticsConsentSessionOverride;
  readonly overrides: AnalyticsConsentSessionOverrides;
  readonly promptIdentity: AnalyticsConsentPromptIdentity;
}): AnalyticsConsentSessionOverrides {
  const nextOverrides = new Map(overrides);
  nextOverrides.set(promptIdentity, override);
  return nextOverrides;
}

/** Completes only the pending save that still owns this visitor scope. */
export function completeAnalyticsConsentSessionSave({
  nextOverride,
  overrides,
  owner,
  promptIdentity,
}: {
  readonly nextOverride: Exclude<
    AnalyticsConsentSessionOverride,
    { readonly persistence: "pending" }
  >;
  readonly overrides: AnalyticsConsentSessionOverrides;
  readonly owner: symbol;
  readonly promptIdentity: AnalyticsConsentPromptIdentity;
}): AnalyticsConsentSessionOverrides {
  const currentOverride = overrides.get(promptIdentity);
  if (
    currentOverride?.persistence !== "pending" ||
    currentOverride.owner !== owner
  ) {
    return overrides;
  }

  return setAnalyticsConsentSessionOverride({
    override: nextOverride,
    overrides,
    promptIdentity,
  });
}

/** Removes only the pending save interrupted by its owning Effect fiber. */
export function cancelAnalyticsConsentSessionSave({
  overrides,
  owner,
  promptIdentity,
}: {
  readonly overrides: AnalyticsConsentSessionOverrides;
  readonly owner: symbol;
  readonly promptIdentity: AnalyticsConsentPromptIdentity;
}): AnalyticsConsentSessionOverrides {
  const currentOverride = overrides.get(promptIdentity);
  if (
    currentOverride?.persistence !== "pending" ||
    currentOverride.owner !== owner
  ) {
    return overrides;
  }

  const nextOverrides = new Map(overrides);
  nextOverrides.delete(promptIdentity);
  return nextOverrides;
}

/** Projects transient prompt, runtime, and persistence policy for one visitor. */
export function resolveAnalyticsConsentSessionPolicy({
  durableConsent,
  hasLoadError,
  overrides,
  promptIdentity,
  status,
}: {
  readonly durableConsent: {
    readonly decidedAt: number;
    readonly noticeVersion: string;
  } | null;
  readonly hasLoadError: boolean;
  readonly overrides: AnalyticsConsentSessionOverrides;
  readonly promptIdentity: AnalyticsConsentPromptIdentity | null;
  readonly status: AnalyticsConsentState["status"];
}) {
  const storedOverride = promptIdentity
    ? overrides.get(promptIdentity)
    : undefined;
  const isSavedChoiceSynchronized =
    storedOverride?.persistence === "saved" &&
    durableConsent !== null &&
    durableConsent.noticeVersion === ANALYTICS_CONSENT_NOTICE_VERSION &&
    durableConsent.decidedAt >= storedOverride.decidedAt;
  const override = isSavedChoiceSynchronized ? undefined : storedOverride;
  const hasHandledPrompt = override !== undefined;
  let effectiveStatus: AnalyticsConsentState["status"] = status;
  if (status !== "browser-signal") {
    if (override?.persistence === "pending") {
      effectiveStatus = "pending";
    } else if (override) {
      effectiveStatus = "denied";
    }
  }

  return {
    hasSaveError: override?.persistence === "failed",
    isPromptOpen:
      !!promptIdentity &&
      !hasHandledPrompt &&
      (status === "prompt" || (hasLoadError && status === "pending")),
    isRuntimeSuppressed: override !== undefined,
    isSaving: override?.persistence === "pending",
    status: effectiveStatus,
  };
}

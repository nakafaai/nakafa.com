import {
  ANALYTICS_CONSENT_NOTICE_VERSION,
  type AnalyticsConsentState,
} from "@repo/analytics/consent";
import { HashMap, Option, Schema } from "effect";

const AnalyticsConsentPromptIdentitySchema = Schema.Union([
  Schema.TemplateLiteral([
    "account:",
    Schema.String,
    `:${ANALYTICS_CONSENT_NOTICE_VERSION}`,
  ]),
  Schema.TemplateLiteral(["anonymous:", ANALYTICS_CONSENT_NOTICE_VERSION]),
]);

export type AnalyticsConsentPromptIdentity =
  typeof AnalyticsConsentPromptIdentitySchema.Type;

const AnalyticsConsentSessionOverrideSchema = Schema.Union([
  Schema.Struct({
    owner: Schema.Symbol,
    persistence: Schema.Literal("pending"),
  }),
  Schema.Struct({ persistence: Schema.Literal("failed") }),
  Schema.Struct({
    decidedAt: Schema.Finite,
    persistence: Schema.Literal("saved"),
  }),
]);

export type AnalyticsConsentSessionOverride =
  typeof AnalyticsConsentSessionOverrideSchema.Type;

export type AnalyticsConsentSessionOverrides = HashMap.HashMap<
  AnalyticsConsentPromptIdentity,
  AnalyticsConsentSessionOverride
>;

/** A session without any visitor-scoped choice yet. */
export const emptyAnalyticsConsentSessionOverrides: AnalyticsConsentSessionOverrides =
  HashMap.empty();

const AnalyticsConsentSessionOperationSchema = Schema.Struct({
  owner: Schema.Symbol,
  promptIdentity: AnalyticsConsentPromptIdentitySchema,
});

export type AnalyticsConsentSessionOperation =
  typeof AnalyticsConsentSessionOperationSchema.Type;

const AnalyticsConsentUserSchema = Schema.Struct({
  appUser: Schema.Struct({ _id: Schema.String }),
});

const DurableAnalyticsConsentSchema = Schema.Struct({
  decidedAt: Schema.Finite,
  noticeVersion: Schema.String,
});

/** Identifies the current account or anonymous scope and consent notice. */
export function createAnalyticsConsentPromptIdentity({
  isAuthenticated,
  user,
}: {
  readonly isAuthenticated: boolean;
  readonly user: typeof AnalyticsConsentUserSchema.Type | null;
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
  return HashMap.set(overrides, promptIdentity, override);
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
  const currentOverride = Option.getOrUndefined(
    HashMap.get(overrides, promptIdentity)
  );
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
  const currentOverride = Option.getOrUndefined(
    HashMap.get(overrides, promptIdentity)
  );
  if (
    currentOverride?.persistence !== "pending" ||
    currentOverride.owner !== owner
  ) {
    return overrides;
  }

  return HashMap.remove(overrides, promptIdentity);
}

/** Allows only the latest revocation without a superseding explicit save. */
export function canCommitAnalyticsConsentRevocation({
  explicitSaveOwnerAtStart,
  latestExplicitSave,
  latestRevocation,
  promptIdentity,
  revocationOwner,
}: {
  readonly explicitSaveOwnerAtStart: symbol | null;
  readonly latestExplicitSave: AnalyticsConsentSessionOperation | null;
  readonly latestRevocation: AnalyticsConsentSessionOperation | null;
  readonly promptIdentity: AnalyticsConsentPromptIdentity;
  readonly revocationOwner: symbol;
}) {
  if (
    latestRevocation?.owner !== revocationOwner ||
    latestRevocation.promptIdentity !== promptIdentity
  ) {
    return false;
  }

  return !(
    latestExplicitSave?.promptIdentity === promptIdentity &&
    latestExplicitSave.owner !== explicitSaveOwnerAtStart
  );
}

/** Projects transient prompt, runtime, and persistence policy for one visitor. */
export function resolveAnalyticsConsentSessionPolicy({
  durableConsent,
  hasLoadError,
  overrides,
  promptIdentity,
  status,
}: {
  readonly durableConsent: typeof DurableAnalyticsConsentSchema.Type | null;
  readonly hasLoadError: boolean;
  readonly overrides: AnalyticsConsentSessionOverrides;
  readonly promptIdentity: AnalyticsConsentPromptIdentity | null;
  readonly status: AnalyticsConsentState["status"];
}) {
  const storedOverride = promptIdentity
    ? Option.getOrUndefined(HashMap.get(overrides, promptIdentity))
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

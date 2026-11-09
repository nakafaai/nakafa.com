import type { EmailId } from "@convex-dev/resend";
import type { WorkflowId } from "@convex-dev/workflow";
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

const commonFields = {
  userId: IdSchema("users"),
};

/**
 * App-owned welcome intent only. Resend owns provider delivery state, events,
 * retries, and retention inside its component tables.
 */
export const welcomeEmailIntentValidator = Schema.Union([
  Schema.Struct({
    ...commonFields,
    phase: Schema.Literal("awaiting-onboarding"),
  }),
  Schema.Struct({
    ...commonFields,
    locale: ActiveAppLocaleCodeSchema,
    phase: Schema.Literal("scheduled"),
    workflowId: Schema.Opaque<WorkflowId>()(Schema.String),
  }),
  Schema.Struct({
    ...commonFields,
    componentEmailId: Schema.Opaque<EmailId>()(Schema.String),
    phase: Schema.Literal("enqueued"),
    workflowId: Schema.optionalKey(Schema.Opaque<WorkflowId>()(Schema.String)),
  }),
]);
export const welcomeIntentInputValidator = Schema.Union([
  Schema.Null,
  Schema.Struct({
    continueUrl: Schema.String,
    locale: ActiveAppLocaleCodeSchema,
    privacyPolicyUrl: Schema.String,
    termsOfServiceUrl: Schema.String,
  }),
]);

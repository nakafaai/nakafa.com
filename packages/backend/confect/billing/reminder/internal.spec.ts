import { FunctionSpec, GroupSpec } from "@confect/core";
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { SiteConfigError } from "@repo/backend/confect/site/spec";
import { Schema } from "effect";

/** What a pass reminder says before the date is written: when the pass ends, and the links it carries. */
export const PassReminderInput = Schema.Struct({
  endsAt: Schema.Finite,
  extendUrl: Schema.String,
  locale: ActiveAppLocaleCodeSchema,
  privacyPolicyUrl: Schema.String,
  termsOfServiceUrl: Schema.String,
});

/** The read and the send of one pass reminder, around the render in the Node runtime. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "readInput",
      args: () => ({
        grantId: IdSchema("billingGrants"),
        locale: ActiveAppLocaleCodeSchema,
      }),
      returns: () => Schema.NullOr(PassReminderInput),
      error: () => Schema.Union([ReleaseError, SiteConfigError]),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "enqueue",
      args: () => ({
        grantId: IdSchema("billingGrants"),
        html: Schema.String,
        subject: Schema.String,
        text: Schema.String,
      }),
      returns: () => Schema.Null,
    })
  );

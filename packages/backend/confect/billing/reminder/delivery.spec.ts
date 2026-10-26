import { FunctionSpec, GroupSpec } from "@confect/core";
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { SiteConfigError } from "@repo/backend/confect/site/spec";
import {
  PassEndingEmailInputError,
  PassEndingEmailRenderError,
} from "@repo/email/templates/pass/contract";
import { Schema } from "effect";

/** Delivers one pass reminder from the Node runtime, where the email package renders. */
export default GroupSpec.makeNode().addFunction(
  FunctionSpec.internalNodeAction({
    name: "deliver",
    args: () => ({
      grantId: IdSchema("billingGrants"),
      locale: ActiveAppLocaleCodeSchema,
    }),
    returns: () => Schema.Null,
    error: () =>
      Schema.Union([
        ReleaseError,
        SiteConfigError,
        PassEndingEmailInputError,
        PassEndingEmailRenderError,
      ]),
  })
);

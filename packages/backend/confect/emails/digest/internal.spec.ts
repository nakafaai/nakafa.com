import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { SiteConfigError } from "@repo/backend/confect/site/spec";
import { DigestEmailInputSchema } from "@repo/email/templates/digest/content";
import { Schema } from "effect";

/**
 * The mail of the notices that are due (ADR 0027): which recipients the day's limit lets through, each with one mail
 * that counts what waited for them, the hand-off to the mail provider, and the send that runs both around the render.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "claim",
      args: () => ({}),
      returns: () =>
        Schema.Array(
          Schema.Struct({
            address: Schema.String,
            input: DigestEmailInputSchema,
            key: Schema.String,
          })
        ),
      error: () => Schema.Union([ReleaseError, SiteConfigError]),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "enqueue",
      args: () => ({
        messages: Schema.Array(
          Schema.Struct({
            address: Schema.String,
            html: Schema.String,
            key: Schema.String,
            subject: Schema.String,
            text: Schema.String,
          })
        ),
      }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "send",
      args: () => ({}),
      returns: () => Schema.Null,
    })
  );

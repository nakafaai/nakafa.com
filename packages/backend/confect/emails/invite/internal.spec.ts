import { FunctionSpec, GroupSpec } from "@confect/core";
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Id } from "@repo/backend/confect/_generated/id";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { SiteConfigError } from "@repo/backend/confect/site/spec";
import { InviteEmailInputSchema } from "@repo/email/templates/invite/content";
import { Schema } from "effect";

/** The two database steps of an invitation email: what to say, and the hand-off to the mail provider. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "readInput",
      args: () => ({
        inviteId: Id("tenantInvites"),
        locale: ActiveAppLocaleCodeSchema,
      }),
      returns: () => Schema.NullOr(InviteEmailInputSchema),
      error: () => Schema.Union([ReleaseError, SiteConfigError]),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "enqueueRendered",
      args: () => ({
        html: Schema.String,
        inviteId: Id("tenantInvites"),
        subject: Schema.String,
        text: Schema.String,
      }),
      returns: () => Schema.Null,
    })
  );

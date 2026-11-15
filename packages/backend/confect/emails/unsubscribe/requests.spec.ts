import { FunctionSpec, GroupSpec } from "@confect/core";
import { UnsubscribeTokenInvalid } from "@repo/backend/confect/emails/unsubscribe/token";
import { Schema } from "effect";

/**
 * An email's unsubscribe (RFC 8058): the page's press and a mail client's one-click post both confirm the token the
 * email carried, with no session, since the token alone names the reader.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.publicMutation({
    name: "confirm",
    args: () => ({ token: Schema.String }),
    returns: () => Schema.Null,
    error: () => UnsubscribeTokenInvalid,
  })
);

import { FunctionSpec, GroupSpec } from "@confect/core";
import {
  TokenCheck,
  TokenIssue,
  TokenResource,
} from "@repo/backend/confect/integrations/schema";
import { Schema } from "effect";

/**
 * The access tokens of integration clients (ADR 0029). The school API's token endpoint
 * issues one, and its bearer check verifies one per request. Both are internal: only the
 * HTTP routes call them, and no browser can.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "issue",
      args: () => ({
        clientId: Schema.String,
        resource: Schema.optional(Schema.String),
        secret: Schema.String,
      }),
      returns: () => TokenIssue,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "check",
      args: () => ({ resource: TokenResource, token: Schema.String }),
      returns: () => TokenCheck,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "sweep",
      args: () => ({}),
      returns: () => Schema.Null,
    })
  );

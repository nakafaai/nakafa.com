import { FunctionSpec, GroupSpec } from "@confect/core";
import {
  AccountUnavailable,
  SessionRequired,
} from "@repo/backend/confect/auth/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  PreferenceChannel,
  SwitchedOff,
} from "@repo/backend/confect/notifications/preference";
import { NoticeKind } from "@repo/backend/confect/notifications/rules";
import { Schema } from "effect";

/**
 * What the signed-in account switched off, for the notices it holds itself (ADR 0027). A reply to its comment belongs to
 * no school, so the choice is the account's, and a kind the account never gets stays as it is.
 */
export default GroupSpec.make()
  .middleware(Session)
  .addFunction(
    FunctionSpec.publicQuery({
      name: "list",
      args: () => ({}),
      returns: () => Schema.Array(SwitchedOff),
      error: () => Schema.Union([SessionRequired, AccountUnavailable]),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "set",
      args: () => ({
        channel: PreferenceChannel,
        kind: NoticeKind,
        on: Schema.Boolean,
      }),
      returns: () => Schema.Null,
      error: () => Schema.Union([SessionRequired, AccountUnavailable]),
    })
  );

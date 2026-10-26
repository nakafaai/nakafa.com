import { FunctionSpec, GroupSpec } from "@confect/core";
import {
  AccountUnavailable,
  SessionRequired,
} from "@repo/backend/confect/auth/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  PushEndpoint,
  SubscriptionKeys,
} from "@repo/backend/confect/notifications/subscription";
import { Schema } from "effect";

/**
 * The push subscriptions of the signed-in account (ADR 0027): a browser
 * subscribes after the person turns notifications on, and unsubscribes when
 * they turn them off. Push is best effort; the inbox holds every notice.
 */
export default GroupSpec.make()
  .middleware(Session)
  .addFunction(
    FunctionSpec.publicMutation({
      name: "subscribe",
      args: () => SubscriptionKeys,
      returns: () => Schema.Null,
      error: () => Schema.Union([SessionRequired, AccountUnavailable]),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "unsubscribe",
      args: () => ({ endpoint: PushEndpoint }),
      returns: () => Schema.Null,
      error: () => Schema.Union([SessionRequired, AccountUnavailable]),
    })
  );

import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { PushEndpoint } from "@repo/backend/confect/notifications/subscription";
import { PushTarget } from "@repo/backend/confect/notifications/webpush";
import { Schema } from "effect";

/** What one push carries and where it goes: the notice's general text, and the recipient's browsers. */
const PushNotice = Schema.Struct({
  payload: Schema.String,
  targets: Schema.Array(PushTarget),
});

/**
 * The push of one inbox row (ADR 0027), internal. The send runs when the row
 * comes, or when the recipient's quiet hours end, reads what to send, sends it
 * to each browser of the recipient's account once, and forgets a subscription
 * whose push service says it is gone.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "notice",
      args: () => ({ notificationId: Id("notifications") }),
      returns: () => Schema.NullOr(PushNotice),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "forget",
      args: () => ({ endpoint: PushEndpoint }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "send",
      args: () => ({ notificationId: Id("notifications") }),
      returns: () => Schema.Null,
    })
  );

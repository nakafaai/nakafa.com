import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  DeliveryDrop,
  DeliveryOutcome,
  ReceiverUrl,
} from "@repo/backend/confect/integrations/hook";
import { Schema } from "effect";

/** What one attempt sends, or why it sends nothing. */
const PreparedDelivery = Schema.Union([
  Schema.Struct({
    attempt: Schema.Finite,
    body: Schema.String,
    event: Id("journalEntries"),
    outcome: Schema.Literal("send"),
    secret: Schema.String,
    type: Schema.String,
    url: ReceiverUrl,
  }),
  Schema.Struct({ outcome: Schema.Literal("drop"), reason: DeliveryDrop }),
  Schema.Struct({ outcome: Schema.Literal("settled") }),
]);

/**
 * The delivery of webhooks. `sweep` runs on a minute cron and starts a run for each webhook
 * with unread changes, and sends again an attempt whose scheduled delivery was lost. `run`
 * reads one page of the school's journal after the webhook's cursor and writes the first
 * attempt of each change it carries. `deliver` sends one attempt, with `prepare` and
 * `settle` on either side of the request. `prune` ends the delivery log's retention.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "sweep",
      args: () => ({ cursor: Schema.NullOr(Schema.String) }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "run",
      args: () => ({ webhookId: Id("integrationWebhooks") }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "prepare",
      args: () => ({ deliveryId: Id("integrationDeliveries") }),
      returns: () => PreparedDelivery,
    })
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "deliver",
      args: () => ({ deliveryId: Id("integrationDeliveries") }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "settle",
      args: () => ({
        deliveryId: Id("integrationDeliveries"),
        outcome: DeliveryOutcome,
      }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "prune",
      args: () => ({}),
      returns: () => Schema.Null,
    })
  );

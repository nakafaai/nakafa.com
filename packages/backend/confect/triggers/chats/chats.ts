import { Scheduler } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";
import { Duration, Effect } from "effect";

/**
 * Trigger handler for chats table changes.
 *
 * Cascades deletion of chat to all associated messages and their parts.
 * Only executes on delete operations to maintain referential integrity.
 *
 * @param ctx - The Convex mutation context with database access
 * @param change - The change object containing operation details and document state
 */
export const chatsHandler = Effect.fn("triggers.chats.chats.chatsHandler")(
  function* (
    ctx: GenericMutationCtx<DataModel>,
    change: Change<DataModel, "chats">
  ) {
    const scheduler = yield* Scheduler.Scheduler.pipe(
      Effect.provide(Scheduler.layer(ctx.scheduler))
    );
    if (change.operation !== "delete") {
      return;
    }
    yield* scheduler.runAfter(
      Duration.millis(0),
      refs.internal.triggers.chats.cleanup.cleanupDeletedChat,
      {
        chatId: change.id,
      }
    );
  }
);

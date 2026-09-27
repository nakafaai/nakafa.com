import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  MutationCtx,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { settleTurn } from "@repo/backend/confect/nina/settlement";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
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
  function* (change: Change<DataModel, "chats">) {
    const scheduler = yield* Scheduler;
    if (change.operation !== "delete") {
      return;
    }
    if (change.oldDoc.activeTurnId) {
      const turn = yield* (yield* DatabaseReader)
        .table("ninaTurns")
        .get(change.oldDoc.activeTurnId)
        .pipe(
          Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
          Effect.orDie
        );
      if (turn) {
        yield* settleTurn(turn, "cancelled").pipe(Effect.orDie);
      }
    }
    const threadId = change.oldDoc.threadId;
    if (threadId) {
      const ctx = yield* MutationCtx;
      // Component-owned batched deletion includes messages, streams and file references.
      yield* Effect.promise(() =>
        ctx.runMutation(components.nina.threads.deleteAllForThreadIdAsync, {
          threadId,
          limit: 10,
        })
      );
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

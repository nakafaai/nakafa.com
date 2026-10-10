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
 * Cancels active generation and cascades journal deletion through Agent. A
 * memory is the learner's own and stays when a chat is deleted.
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
    const ctx = yield* MutationCtx;
    // Component-owned batched deletion includes messages, streams and file references.
    yield* Effect.promise(() =>
      ctx.runMutation(components.nina.threads.deleteAllForThreadIdAsync, {
        threadId: change.oldDoc.threadId,
        limit: 10,
      })
    );
    yield* scheduler.runAfter(
      Duration.millis(0),
      refs.internal.triggers.chats.cleanup.cleanupDeletedChat,
      {
        chatId: change.id,
      }
    );
  }
);

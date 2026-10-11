import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  MutationCtx,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { forgetChat } from "@repo/backend/confect/nina/memory/store";
import { settleTurn } from "@repo/backend/confect/nina/settlement";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { Change } from "convex-helpers/server/triggers";
import { Duration, Effect } from "effect";

/**
 * Settles the chat's open turn, forgets the facts remembered from the chat, and
 * cascades journal deletion through Agent. The chat and its journal go in this
 * transaction, so nothing a run that is still alive writes can survive: the
 * hold is paid back without waiting for the run to exit, and the run's next
 * check finds its turn settled and stops its provider call.
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
    yield* forgetChat(change.oldDoc);
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

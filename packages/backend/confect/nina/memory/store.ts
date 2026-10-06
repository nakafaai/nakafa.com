import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Array as Arr, Clock, Effect } from "effect";

/** Finds a learner's memory, which exists only while memory is on. */
export const findMemory = Effect.fn("nina.memory.find")(function* (
  userId: Docs["users"]["_id"]
) {
  return yield* (yield* DatabaseReader)
    .table("ninaMemories")
    .get("by_userId", userId)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
});

/** Forgets the facts remembered from a deleted chat. */
export const forgetChat = Effect.fn("nina.memory.forgetChat")(function* (
  chat: Pick<Docs["chats"], "_id" | "userId">
) {
  const memory = yield* findMemory(chat.userId);
  if (!memory) {
    return;
  }
  const facts = Arr.filter(memory.facts, (fact) => fact.chatId !== chat._id);
  if (facts.length === memory.facts.length) {
    return;
  }
  yield* (yield* DatabaseWriter)
    .table("ninaMemories")
    .patch(memory._id, { facts, updatedAt: yield* Clock.currentTimeMillis })
    .pipe(Effect.orDie);
});

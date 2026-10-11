import { RegisteredConvexFunction } from "@confect/server";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import schema from "@repo/backend/confect/_generated/schema";
import { sealTitle } from "@repo/backend/confect/chats/title";
import { sealSummary } from "@repo/backend/confect/nina/summaries/text";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect, String as Str } from "effect";

const decoder = new TextDecoder();

type UserId = Docs["users"]["_id"];

/**
 * Whether stored bytes show a text: they decode to a string that holds it. A
 * sealed value must not, so a table export shows no readable text.
 */
export function showsText(stored: ArrayBuffer | undefined, text: string) {
  if (stored === undefined) {
    return false;
  }
  return Str.includes(text)(decoder.decode(stored));
}

/**
 * Seals a chat title for the learner who owns the chat, with the function the
 * product seals it with, so a fixture holds a title the way a real write
 * stores it.
 */
export function sealedTitle(ctx: MutationCtx, userId: UserId, title: string) {
  return Effect.runPromise(
    sealTitle(userId, title).pipe(
      Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
    )
  );
}

/**
 * Seals a summary text for the learner who owns the chat, the way
 * `sealedTitle` seals a title.
 */
export function sealedSummary(ctx: MutationCtx, userId: UserId, text: string) {
  return Effect.runPromise(
    sealSummary(userId, text).pipe(
      Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
    )
  );
}

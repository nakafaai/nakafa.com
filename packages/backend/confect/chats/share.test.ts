import { describe, expect, it } from "@effect/vitest";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { shareTokenValidator } from "@repo/backend/confect/chats/schema";
import {
  findShare,
  matchesShare,
  openShareToken,
  startSharing,
  stopSharing,
} from "@repo/backend/confect/chats/share";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { MASCOT } from "@repo/backend/test/mascot";
import { showsText } from "@repo/backend/test/seal";
import { Effect, Option, Schema } from "effect";

/** A SHA-256 digest in lower-case hexadecimal. */
const SHA256_HEX = /^[0-9a-f]{64}$/u;

/** Runs one scenario inside a mutation of a fresh deployment. */
const scenario = <A, Failure>(
  body: Effect.Effect<A, Failure, DatabaseReader | DatabaseWriter>
) =>
  Effect.gen(function* () {
    yield* (yield* Confect).run(body.pipe(Effect.orDie));
  }).pipe(Effect.provide(confectLayer));

/** Creates one account and one private chat of it, and loads the chat back. */
const chatOf = Effect.fn("test.chats.share.chat")(function* (name: string) {
  const userId = yield* (yield* DatabaseWriter).table("users").insert({
    authId: `share-${name}`,
    credits: 0,
    creditsResetAt: 0,
    email: `${name}@example.com`,
    mascot: MASCOT,
    name,
    plan: "free",
  });
  const chatId = yield* (yield* DatabaseWriter).table("chats").insert({
    threadId: "thread",
    type: "study",
    updatedAt: 0,
    userId,
    visibility: "private",
  });
  return yield* (yield* DatabaseReader).table("chats").get(chatId);
});

/** Shares a chat and returns the token its owner reads back. */
const share = Effect.fn("test.chats.share.token")(function* (
  chat: Docs["chats"]
) {
  yield* startSharing(chat);
  return yield* openShareToken(
    Option.getOrThrow(Option.fromNullishOr(yield* findShare(chat._id)))
  );
});

describe("chat shares", () => {
  it.effect(
    "stores a hash and sealed bytes, never a token that opens the chat",
    () =>
      scenario(
        Effect.gen(function* () {
          const chat = yield* chatOf("owner");
          const token = yield* share(chat);
          const stored = Option.getOrThrow(
            Option.fromNullishOr(yield* findShare(chat._id))
          );
          // 32 random bytes, in the 43 characters a link carries.
          expect(Schema.is(shareTokenValidator)(token)).toBe(true);
          expect(stored.userId).toBe(chat.userId);
          expect(stored.hash).toMatch(SHA256_HEX);
          expect(stored.hash).not.toBe(token);
          expect(stored.token).toBeInstanceOf(ArrayBuffer);
          expect(showsText(stored.token, token)).toBe(false);
          // What a table export shows opens nothing.
          expect(yield* matchesShare(chat._id, stored.hash.slice(0, 43))).toBe(
            false
          );
          expect(yield* matchesShare(chat._id, token)).toBe(true);
        })
      )
  );

  it.effect(
    "keeps its token while a chat stays shared and draws a new one after sharing stopped",
    () =>
      scenario(
        Effect.gen(function* () {
          const chat = yield* chatOf("owner");
          const first = yield* share(chat);
          expect(yield* share(chat)).toBe(first);
          yield* stopSharing(chat._id);
          expect(yield* findShare(chat._id)).toBeNull();
          expect(yield* matchesShare(chat._id, first)).toBe(false);
          const second = yield* share(chat);
          expect(second).not.toBe(first);
          expect(yield* matchesShare(chat._id, first)).toBe(false);
          expect(yield* matchesShare(chat._id, second)).toBe(true);
        })
      )
  );

  it.effect(
    "draws a token for each chat that opens that chat alone, and stops nothing for a chat that is not shared",
    () =>
      scenario(
        Effect.gen(function* () {
          const one = yield* chatOf("one");
          const two = yield* chatOf("two");
          const unshared = yield* chatOf("unshared");
          const oneToken = yield* share(one);
          const twoToken = yield* share(two);
          expect(oneToken).not.toBe(twoToken);
          expect(yield* matchesShare(one._id, twoToken)).toBe(false);
          expect(yield* matchesShare(two._id, oneToken)).toBe(false);
          expect(yield* matchesShare(unshared._id, oneToken)).toBe(false);
          yield* stopSharing(unshared._id);
          expect(yield* matchesShare(one._id, oneToken)).toBe(true);
          expect(yield* matchesShare(two._id, twoToken)).toBe(true);
        })
      )
  );
});

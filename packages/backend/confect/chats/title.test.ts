import { describe, expect, it } from "@effect/vitest";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  openChat,
  openChats,
  sealTitle,
} from "@repo/backend/confect/chats/title";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import {
  ensureLearnerKeys,
  readLearnerKeys,
} from "@repo/backend/confect/vault/keys";
import { VaultError } from "@repo/backend/confect/vault/schema";
import { sealText } from "@repo/backend/confect/vault/text";
import { showsText } from "@repo/backend/test/seal";
import { Array as Arr, Cause, Effect, Exit, Result } from "effect";

/** Runs one scenario inside a mutation of a fresh deployment. */
const scenario = <A, Failure>(
  body: Effect.Effect<A, Failure, DatabaseReader | DatabaseWriter>
) =>
  Effect.gen(function* () {
    yield* (yield* Confect).run(body.pipe(Effect.orDie));
  }).pipe(Effect.provide(confectLayer));

/** Creates one account and returns its id. */
const learner = Effect.fn("test.chats.title.learner")(function* (name: string) {
  return yield* (yield* DatabaseWriter).table("users").insert({
    authId: `title-${name}`,
    credits: 0,
    creditsResetAt: 0,
    email: `${name}@example.com`,
    name,
    plan: "free",
  });
});

/** Stores one chat of a learner with the given stored title, and loads it back. */
const chatOf = Effect.fn("test.chats.title.chat")(function* (
  userId: Docs["users"]["_id"],
  title?: string | ArrayBuffer
) {
  const chatId = yield* (yield* DatabaseWriter).table("chats").insert({
    threadId: "thread",
    type: "study",
    updatedAt: 0,
    userId,
    visibility: "private",
    ...(title === undefined ? {} : { title }),
  });
  return yield* (yield* DatabaseReader).table("chats").get(chatId);
});

describe("chat titles", () => {
  it.effect(
    "seals a title so the stored bytes hold no text, and opens it for its owner",
    () =>
      scenario(
        Effect.gen(function* () {
          const owner = yield* learner("owner");
          const sealed = yield* sealTitle(owner, "Latihan aljabar");
          // The check sees a text where one is stored, so its silence means something.
          expect(showsText("Latihan aljabar", "Latihan aljabar")).toBe(true);
          expect(
            showsText(
              new TextEncoder().encode("a Latihan aljabar b").buffer,
              "Latihan aljabar"
            )
          ).toBe(true);
          expect(showsText(sealed, "Latihan aljabar")).toBe(false);
          const chat = yield* chatOf(owner, sealed);
          expect(chat.title).toBeInstanceOf(ArrayBuffer);
          expect(yield* openChat(chat)).toMatchObject({
            _id: chat._id,
            title: "Latihan aljabar",
          });
        })
      )
  );

  it.effect(
    "opens a plain title and a sealed title to the same text, and a plain title needs no key",
    () =>
      scenario(
        Effect.gen(function* () {
          const plainOwner = yield* learner("plain");
          const sealedOwner = yield* learner("sealed");
          const plain = yield* chatOf(plainOwner, "Same title");
          const sealed = yield* chatOf(
            sealedOwner,
            yield* sealTitle(sealedOwner, "Same title")
          );
          expect(
            Arr.map(yield* openChats(plainOwner, [plain]), (chat) => chat.title)
          ).toEqual(["Same title"]);
          expect(
            Arr.map(
              yield* openChats(sealedOwner, [sealed]),
              (chat) => chat.title
            )
          ).toEqual(["Same title"]);
          expect((yield* Effect.flip(readLearnerKeys(plainOwner))).reason).toBe(
            "key"
          );
        })
      )
  );

  it.effect(
    "opens a mixed list in order and leaves a chat without a title without one",
    () =>
      scenario(
        Effect.gen(function* () {
          const owner = yield* learner("owner");
          const opened = yield* openChats(owner, [
            yield* chatOf(owner),
            yield* chatOf(owner, "Plain"),
            yield* chatOf(owner, yield* sealTitle(owner, "Sealed")),
          ]);
          expect(Arr.map(opened, (chat) => chat.title)).toEqual([
            undefined,
            "Plain",
            "Sealed",
          ]);
          expect(Arr.map(opened, (chat) => "title" in chat)).toEqual([
            false,
            true,
            true,
          ]);
        })
      )
  );

  it.effect(
    "reads the learner's key once for a whole list and none for an empty one",
    () =>
      scenario(
        Effect.gen(function* () {
          const owner = yield* learner("owner");
          const chats = [
            yield* chatOf(owner, yield* sealTitle(owner, "One")),
            yield* chatOf(owner, yield* sealTitle(owner, "Two")),
            yield* chatOf(owner, yield* sealTitle(owner, "Three")),
          ];
          const table = vi.spyOn(yield* DatabaseReader, "table");
          const keyReads = () =>
            Arr.filter(table.mock.calls, ([name]) => name === "vaultKeys")
              .length;
          expect(
            Arr.map(yield* openChats(owner, chats), (chat) => chat.title)
          ).toEqual(["One", "Two", "Three"]);
          expect(keyReads()).toBe(1);
          table.mockClear();
          expect(yield* openChats(owner, [])).toEqual([]);
          expect(keyReads()).toBe(0);
        })
      )
  );

  it.effect(
    "refuses to open a title with the keys of another learner or for another field",
    () =>
      scenario(
        Effect.gen(function* () {
          const owner = yield* learner("owner");
          const other = yield* learner("other");
          yield* ensureLearnerKeys(other);
          const chat = yield* chatOf(owner, yield* sealTitle(owner, "Secret"));
          const stranger = yield* Effect.exit(openChats(other, [chat]));
          expect(Exit.isFailure(stranger)).toBe(true);
          if (Exit.isFailure(stranger)) {
            expect(Cause.findDefect(stranger.cause)).toEqual(
              Result.succeed(new VaultError({ reason: "cipher" }))
            );
          }
          const elsewhere = yield* sealText(
            yield* ensureLearnerKeys(owner),
            { field: "text", table: "ninaSummaries" },
            "Secret"
          );
          const moved = yield* Effect.exit(
            openChat(yield* chatOf(owner, elsewhere))
          );
          expect(Exit.isFailure(moved)).toBe(true);
        })
      )
  );
});

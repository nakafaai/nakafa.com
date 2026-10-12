import { describe, expect, it } from "@effect/vitest";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { openMemories, openWith } from "@repo/backend/confect/nina/memory/seal";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import {
  ensureLearnerKeys,
  shredLearnerKeys,
} from "@repo/backend/confect/vault/keys";
import { sealText } from "@repo/backend/confect/vault/text";
import { Effect, Exit } from "effect";

// The stored fields as the database names them. Memories are already sealed in
// storage under these names, so a change of either would strand every one.
const words = { field: "text", table: "ninaMemories" };
const title = { field: "title", table: "ninaMemories" };

/** Runs one scenario inside a mutation of a fresh deployment. */
const scenario = <A, Failure>(
  body: Effect.Effect<A, Failure, DatabaseReader | DatabaseWriter>
) =>
  Effect.gen(function* () {
    yield* (yield* Confect).run(body.pipe(Effect.orDie));
  }).pipe(Effect.provide(confectLayer));

/** Creates one account and returns its keys. */
const learner = Effect.fn("test.memory.seal.learner")(function* (name: string) {
  const userId = yield* (yield* DatabaseWriter).table("users").insert({
    authId: `seal-${name}`,
    credits: 0,
    creditsResetAt: 0,
    email: `${name}@example.com`,
    name,
    plan: "free",
  });
  return yield* ensureLearnerKeys(userId);
});

/** Stores one memory with the sealed values as given, and reads the row back. */
const store = Effect.fn("test.memory.seal.store")(function* (
  userId: Docs["users"]["_id"],
  sealed: { readonly text: ArrayBuffer; readonly title?: ArrayBuffer }
) {
  const id = yield* (yield* DatabaseWriter).table("ninaMemories").insert({
    author: "learner",
    confirmedAt: 1,
    userId,
    ...sealed,
  });
  return yield* (yield* DatabaseReader).table("ninaMemories").get(id);
});

describe("memory seal", () => {
  it.effect(
    "opens the words and the title of a memory, and leaves a memory with no title without one",
    () =>
      scenario(
        Effect.gen(function* () {
          const keys = yield* learner("owner");
          const titled = yield* store(keys.userId, {
            text: yield* sealText(keys, words, "Kelas 12 IPA"),
            title: yield* sealText(keys, title, "Sekolah"),
          });
          const bare = yield* store(keys.userId, {
            text: yield* sealText(keys, words, "Ikut SNBT"),
          });
          const opened = yield* openWith(keys, [titled, bare]);
          expect(opened).toEqual([
            { ...titled, text: "Kelas 12 IPA", title: "Sekolah" },
            { ...bare, text: "Ikut SNBT" },
          ]);
          expect(opened[1]).not.toHaveProperty("title");
        })
      )
  );

  it.effect("does not open a title sealed for another learner", () =>
    scenario(
      Effect.gen(function* () {
        const owner = yield* learner("owner");
        const other = yield* learner("other");
        // The words are the other learner's own, so only the title can fail.
        const taken = yield* store(other.userId, {
          text: yield* sealText(other, words, "Kelas 12 IPA"),
          title: yield* sealText(owner, title, "Sekolah"),
        });
        const own = yield* store(other.userId, {
          text: yield* sealText(other, words, "Kelas 12 IPA"),
          title: yield* sealText(other, title, "Sekolah"),
        });
        expect((yield* Effect.flip(openWith(other, [taken]))).reason).toBe(
          "cipher"
        );
        expect(yield* openWith(other, [own])).toMatchObject([
          { text: "Kelas 12 IPA", title: "Sekolah" },
        ]);
      })
    )
  );

  it.effect(
    "does not open a value sealed for the words as the title, or one sealed for the title as the words",
    () =>
      scenario(
        Effect.gen(function* () {
          const keys = yield* learner("owner");
          const wordsAsTitle = yield* store(keys.userId, {
            text: yield* sealText(keys, words, "Kelas 12 IPA"),
            title: yield* sealText(keys, words, "Sekolah"),
          });
          const titleAsWords = yield* store(keys.userId, {
            text: yield* sealText(keys, title, "Kelas 12 IPA"),
            title: yield* sealText(keys, title, "Sekolah"),
          });
          for (const memory of [wordsAsTitle, titleAsWords]) {
            expect((yield* Effect.flip(openWith(keys, [memory]))).reason).toBe(
              "cipher"
            );
          }
        })
      )
  );

  it.effect(
    "opens no memory for a learner who has none without reading a key, and treats a memory without its learner key as a defect",
    () =>
      scenario(
        Effect.gen(function* () {
          const keys = yield* learner("owner");
          const memory = yield* store(keys.userId, {
            text: yield* sealText(keys, words, "Kelas 12 IPA"),
          });
          expect(yield* openMemories(keys.userId, [memory])).toMatchObject([
            { text: "Kelas 12 IPA" },
          ]);
          yield* shredLearnerKeys(keys.userId);
          expect(yield* openMemories(keys.userId, [])).toEqual([]);
          const exit = yield* Effect.exit(openMemories(keys.userId, [memory]));
          expect(Exit.hasDies(exit)).toBe(true);
        })
      )
  );
});

import { describe, expect, it } from "@effect/vitest";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import {
  ensureLearnerKeys,
  readLearnerKeys,
  shredLearnerKeys,
} from "@repo/backend/confect/vault/keys";
import { openText, sealText } from "@repo/backend/confect/vault/text";
import { ConfigProvider, Effect } from "effect";
import { Base64 } from "effect/encoding";

const memory = { field: "text", table: "ninaMemories" };
const summary = { field: "text", table: "ninaSummaries" };
const fact = "Lebih suka contoh soal dulu, baru rumusnya.";

/** Creates one account and returns its id. */
const learner = Effect.fn("test.vault.learner")(function* (name: string) {
  return yield* (yield* DatabaseWriter).table("users").insert({
    authId: `vault-${name}`,
    credits: 0,
    creditsResetAt: 0,
    email: `${name}@example.com`,
    name,
    plan: "free",
  });
});

/** Runs one scenario inside a mutation of a fresh deployment. */
const scenario = <A, Failure>(
  body: Effect.Effect<A, Failure, DatabaseReader | DatabaseWriter>
) =>
  Effect.gen(function* () {
    yield* (yield* Confect).run(body.pipe(Effect.orDie));
  }).pipe(Effect.provide(confectLayer));

/** Runs an effect with only the named root keys in the environment. */
const withRoots = (roots: string) =>
  Effect.provide(
    ConfigProvider.layer(ConfigProvider.fromUnknown({ VAULT_ROOT_KEYS: roots }))
  );

describe("vault learner keys", () => {
  it.effect(
    "creates one wrapped key on the first seal and reads it back to open",
    () =>
      scenario(
        Effect.gen(function* () {
          const userId = yield* learner("first");
          expect((yield* Effect.flip(readLearnerKeys(userId))).reason).toBe(
            "key"
          );
          const sealed = yield* sealText(
            yield* ensureLearnerKeys(userId),
            memory,
            fact
          );
          const again = yield* sealText(
            yield* ensureLearnerKeys(userId),
            memory,
            fact
          );
          expect(new Uint8Array(again)).toEqual(new Uint8Array(sealed));
          const rows = yield* (yield* DatabaseReader)
            .table("vaultKeys")
            .index("by_userId", (query) => query.eq("userId", userId))
            .collect();
          expect(rows).toMatchObject([{ root: "test", userId }]);
          expect(rows[0]?.wrapped.byteLength).toBe(1 + 12 + 32 + 16);
          expect(
            yield* openText(yield* readLearnerKeys(userId), memory, sealed)
          ).toBe(fact);
        })
      )
  );

  it.effect(
    "opens a text only for the learner and the field it was sealed for",
    () =>
      scenario(
        Effect.gen(function* () {
          const owner = yield* ensureLearnerKeys(yield* learner("owner"));
          const other = yield* ensureLearnerKeys(yield* learner("other"));
          const sealed = yield* sealText(owner, memory, fact);
          for (const [keys, field] of [
            [other, memory],
            [owner, summary],
            [{ ...owner, userId: other.userId }, memory],
          ] as const) {
            expect(
              (yield* Effect.flip(openText(keys, field, sealed))).reason
            ).toBe("cipher");
          }
        })
      )
  );

  it.effect(
    "fails with a key error when no root key in the environment unwraps the learner key",
    () =>
      scenario(
        Effect.gen(function* () {
          const userId = yield* learner("moved");
          yield* ensureLearnerKeys(userId);
          const unknown = `gone:${Base64.encode(new Uint8Array(32).fill(9))}`;
          const renamed = `test:${Base64.encode(new Uint8Array(32).fill(9))}`;
          for (const roots of [unknown, renamed]) {
            for (const read of [readLearnerKeys, ensureLearnerKeys]) {
              expect(
                (yield* Effect.flip(read(userId).pipe(withRoots(roots)))).reason
              ).toBe("key");
            }
          }
        })
      )
  );

  it.effect("shreds a learner's key and leaves another learner's", () =>
    scenario(
      Effect.gen(function* () {
        const userId = yield* learner("leaving");
        const kept = yield* learner("staying");
        const sealed = yield* sealText(
          yield* ensureLearnerKeys(userId),
          memory,
          fact
        );
        yield* ensureLearnerKeys(kept);
        expect(yield* shredLearnerKeys(userId)).toBe(true);
        expect(yield* shredLearnerKeys(userId)).toBe(false);
        expect((yield* Effect.flip(readLearnerKeys(userId))).reason).toBe(
          "key"
        );
        yield* readLearnerKeys(kept);
        const fresh = yield* ensureLearnerKeys(userId);
        expect(
          (yield* Effect.flip(openText(fresh, memory, sealed))).reason
        ).toBe("cipher");
      })
    )
  );
});

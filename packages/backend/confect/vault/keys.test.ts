import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  createTenantKey,
  ensureConnectorKeys,
  ensureLearnerKeys,
  readLearnerKeys,
  readTenantKeys,
  shredLearnerKeys,
} from "@repo/backend/confect/vault/keys";
import {
  blindConnectorText,
  openText,
  sealText,
} from "@repo/backend/confect/vault/text";
import {
  fact,
  learner,
  memory,
  scenario,
  school,
} from "@repo/backend/test/owner";
import { TEST_ROOT_KEYS, withRoots } from "@repo/backend/test/vault";
import { Array as Arr, Effect, Option } from "effect";
import { Base64 } from "effect/encoding";

const { current, retired } = TEST_ROOT_KEYS;

/** The stored key rows of one school, oldest generation first. */
const schoolRows = Effect.fn("test.vault.schoolRows")(function* (
  tenantId: GenericId.GenericId<"tenants">
) {
  return yield* (yield* DatabaseReader)
    .table("tenantKeys")
    .index("by_tenantId_and_generation", (query) =>
      query.eq("tenantId", tenantId)
    )
    .collect();
});

/** The stored key row of one learner. */
const learnerRow = Effect.fn("test.vault.learnerRow")(function* (
  userId: GenericId.GenericId<"users">
) {
  return yield* (yield* DatabaseReader)
    .table("vaultKeys")
    .get("by_userId", userId)
    .pipe(Effect.orDie);
});

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
    "fails with a configuration error when the environment lacks the root key that a learner key names",
    () =>
      scenario(
        Effect.gen(function* () {
          const userId = yield* learner("moved");
          yield* ensureLearnerKeys(userId);
          const unknown = `gone:${Base64.encode(new Uint8Array(32).fill(9))}`;
          for (const read of [readLearnerKeys, ensureLearnerKeys]) {
            expect(
              (yield* Effect.flip(read(userId).pipe(withRoots(unknown)))).reason
            ).toBe("configuration");
          }
        })
      )
  );

  it.effect(
    "fails with a key error when the root key in the environment does not open the learner key",
    () =>
      scenario(
        Effect.gen(function* () {
          const userId = yield* learner("renamed");
          yield* ensureLearnerKeys(userId);
          const renamed = `test:${Base64.encode(new Uint8Array(32).fill(9))}`;
          for (const read of [readLearnerKeys, ensureLearnerKeys]) {
            expect(
              (yield* Effect.flip(read(userId).pipe(withRoots(renamed)))).reason
            ).toBe("key");
          }
        })
      )
  );

  it.effect(
    "reads a learner key that a retired root key wraps while the current root key is also set",
    () =>
      scenario(
        Effect.gen(function* () {
          const userId = yield* learner("lama");
          const sealed = yield* sealText(
            yield* ensureLearnerKeys(userId).pipe(withRoots(retired)),
            memory,
            fact
          );
          expect((yield* learnerRow(userId)).root).toBe("old");
          const both = withRoots(`${current},${retired}`);
          expect(
            yield* openText(
              yield* readLearnerKeys(userId).pipe(both),
              memory,
              sealed
            )
          ).toBe(fact);
          expect(
            yield* openText(
              yield* ensureLearnerKeys(userId).pipe(both),
              memory,
              sealed
            )
          ).toBe(fact);
        })
      )
  );

  it.effect("gives no key to a deleted or unknown account", () =>
    scenario(
      Effect.gen(function* () {
        const writer = yield* DatabaseWriter;
        const deleted = yield* learner("deleted");
        yield* writer.table("users").patch(deleted, { deletedAt: 1 });
        const gone = yield* learner("gone");
        yield* writer.table("users").delete(gone);
        for (const userId of [deleted, gone]) {
          expect((yield* Effect.flip(ensureLearnerKeys(userId))).reason).toBe(
            "key"
          );
        }
        expect(
          yield* (yield* DatabaseReader)
            .table("vaultKeys")
            .index("by_creation_time")
            .collect()
        ).toEqual([]);
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
        const keptSealed = yield* sealText(
          yield* ensureLearnerKeys(kept),
          memory,
          fact
        );
        expect(yield* shredLearnerKeys(userId)).toBe(true);
        expect(yield* shredLearnerKeys(userId)).toBe(false);
        expect((yield* Effect.flip(readLearnerKeys(userId))).reason).toBe(
          "key"
        );
        expect(
          yield* openText(yield* readLearnerKeys(kept), memory, keptSealed)
        ).toBe(fact);
        const fresh = yield* ensureLearnerKeys(userId);
        expect(
          (yield* Effect.flip(openText(fresh, memory, sealed))).reason
        ).toBe("cipher");
      })
    )
  );
});

describe("vault school keys", () => {
  it.effect(
    "wraps one school key under the current root key and opens the school's text with it",
    () =>
      scenario(
        Effect.gen(function* () {
          const tenantId = yield* school("harapan");
          yield* createTenantKey(tenantId);
          const rows = yield* schoolRows(tenantId);
          expect(rows).toMatchObject([
            { generation: 1, root: "test", tenantId },
          ]);
          expect(Option.getOrThrow(Arr.head(rows)).wrapped.byteLength).toBe(
            1 + 12 + 32 + 16
          );
          const sealed = yield* sealText(
            yield* readTenantKeys(tenantId),
            memory,
            fact
          );
          expect(
            yield* openText(yield* readTenantKeys(tenantId), memory, sealed)
          ).toBe(fact);
        })
      )
  );

  it.effect(
    "reads a school key that a retired root key wraps while the current root key is also set",
    () =>
      scenario(
        Effect.gen(function* () {
          const tenantId = yield* school("lama");
          yield* createTenantKey(tenantId).pipe(withRoots(retired));
          expect(
            Option.getOrThrow(Arr.head(yield* schoolRows(tenantId))).root
          ).toBe("old");
          const both = withRoots(`${current},${retired}`);
          const sealed = yield* sealText(
            yield* readTenantKeys(tenantId).pipe(both),
            memory,
            fact
          );
          expect(
            yield* openText(
              yield* readTenantKeys(tenantId).pipe(both),
              memory,
              sealed
            )
          ).toBe(fact);
        })
      )
  );

  it.effect("fails with a key error for a school that has no key", () =>
    scenario(
      Effect.gen(function* () {
        const tenantId = yield* school("tanpa");
        expect((yield* Effect.flip(readTenantKeys(tenantId))).reason).toBe(
          "key"
        );
      })
    )
  );

  it.effect(
    "reads the newest generation and never falls back to an older one",
    () =>
      scenario(
        Effect.gen(function* () {
          const tenantId = yield* school("baru");
          yield* createTenantKey(tenantId);
          const first = Option.getOrThrow(
            Arr.head(yield* schoolRows(tenantId))
          );
          // A newer row whose wrapped key belongs to generation 1 cannot open
          // under its own binding, so the reader must fail rather than use gen 1.
          yield* (yield* DatabaseWriter).table("tenantKeys").insert({
            createdAt: 2,
            generation: 2,
            root: first.root,
            tenantId,
            wrapped: first.wrapped,
          });
          expect((yield* Effect.flip(readTenantKeys(tenantId))).reason).toBe(
            "key"
          );
        })
      )
  );

  it.effect(
    "never opens a learner's key as a school key, nor a school's key as a learner's",
    () =>
      scenario(
        Effect.gen(function* () {
          const writer = yield* DatabaseWriter;
          const userId = yield* learner("pindah");
          yield* ensureLearnerKeys(userId);
          const tenantId = yield* school("pindahsekolah");
          yield* writer.table("tenantKeys").insert({
            createdAt: 1,
            generation: 1,
            root: "test",
            tenantId,
            wrapped: (yield* learnerRow(userId)).wrapped,
          });
          expect((yield* Effect.flip(readTenantKeys(tenantId))).reason).toBe(
            "key"
          );

          const other = yield* school("sekolahlain");
          yield* createTenantKey(other);
          const otherLearner = yield* learner("lainnya");
          yield* writer.table("vaultKeys").insert({
            createdAt: 1,
            root: "test",
            userId: otherLearner,
            wrapped: Option.getOrThrow(Arr.head(yield* schoolRows(other)))
              .wrapped,
          });
          expect(
            (yield* Effect.flip(readLearnerKeys(otherLearner))).reason
          ).toBe("key");
        })
      )
  );
});

describe("vault connector key", () => {
  it.effect(
    "creates one connector key on first use, and every later call reads that same key",
    () =>
      scenario(
        Effect.gen(function* () {
          const binding = "nakafa/test/connector/v1";
          const first = yield* blindConnectorText(
            yield* ensureConnectorKeys(),
            binding,
            "google-subject"
          );
          const second = yield* blindConnectorText(
            yield* ensureConnectorKeys(),
            binding,
            "google-subject"
          );
          const rows = yield* (yield* DatabaseReader)
            .table("connectorKeys")
            .index("by_key", (query) => query.eq("key", "primary"))
            .collect();
          expect(second).toBe(first);
          expect(Arr.map(rows, (row) => row.root)).toEqual(["test"]);
        })
      )
  );
});

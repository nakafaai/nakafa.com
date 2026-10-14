import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { NEW_TENANT_POLICIES } from "@repo/backend/confect/tenancy/policy";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import {
  createTenantKey,
  ensureLearnerKeys,
  readLearnerKeys,
  readTenantKeys,
  shredLearnerKeys,
} from "@repo/backend/confect/vault/keys";
import {
  blindText,
  openText,
  sealText,
} from "@repo/backend/confect/vault/text";
import {
  Array as Arr,
  ConfigProvider,
  Effect,
  Option,
  Result,
  Schema,
} from "effect";
import { Base64, Hex } from "effect/encoding";

const memory = { field: "text", table: "ninaMemories" };
const summary = { field: "text", table: "ninaSummaries" };
const title = { field: "title", table: "ninaMemories" };
const fact = "Lebih suka contoh soal dulu, baru rumusnya.";
const BLIND = /^[\w-]{22}$/u;
/**
 * A learner whose stored form the golden values below were written for. The
 * test database accepts an ID made of digits and the table name only.
 */
const GOLDEN_USER = "1users";
const goldenUser = Schema.decodeUnknownSync(Id("users"))(GOLDEN_USER);
const slugOf = Schema.decodeSync(TenantSlug);
/** The learner's key under the test root key, as the code wrote it before school keys. */
const GOLDEN_WRAPPED =
  "0132f26fc9be7efd3b0c3840e3209fd9c71d5e151771c32b7dff0825effa85289411a2ae84127036bf2b6ed993451fff581f3fcddbce36fdf71eb6eed6";
/** `fact` sealed under that learner's key, as the code wrote it before school keys. */
const GOLDEN_SEALED =
  "01a2f710347047a93050de3b46e57dc6c74a4994390fd30a7a3f341538b1cabf1d5958fdaf390956073052fca5cd13aced4ff8483c0cc40c058809e1e35dc2d178e0484ae540fc83";

/** The bytes of a stored value, written as hex. */
const bytes = (hex: string) =>
  new Uint8Array(Result.getOrThrow(Hex.decode(hex))).buffer;

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

/** Creates one school with no key yet and returns its id. */
const school = Effect.fn("test.vault.school")(function* (slug: string) {
  return yield* (yield* DatabaseWriter).table("tenants").insert({
    country: "ID",
    currency: "IDR",
    kind: "school",
    name: `Sekolah ${slug}`,
    policies: NEW_TENANT_POLICIES,
    slug: slugOf(slug),
    status: "active",
  });
});

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
            [owner, title],
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
    "blinds a word for one learner and one field, the same way every time",
    () =>
      scenario(
        Effect.gen(function* () {
          const owner = yield* ensureLearnerKeys(yield* learner("owner"));
          const other = yield* ensureLearnerKeys(yield* learner("other"));
          const blinded = yield* blindText(owner, memory, "trigon");
          expect(blinded).toMatch(BLIND);
          expect(blinded).not.toContain("trigon");
          expect(yield* blindText(owner, memory, "trigon")).toBe(blinded);
          // The key that is read back later blinds the same word the same way.
          expect(
            yield* blindText(
              yield* readLearnerKeys(owner.userId),
              memory,
              "trigon"
            )
          ).toBe(blinded);
          // Another learner, another field and another word each give another value.
          for (const value of [
            yield* blindText(other, memory, "trigon"),
            yield* blindText(owner, title, "trigon"),
            yield* blindText(owner, memory, "trigono"),
            yield* blindText(
              { ...owner, userId: other.userId },
              memory,
              "trigon"
            ),
          ]) {
            expect(value).toMatch(BLIND);
            expect(value).not.toBe(blinded);
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

  it.effect(
    "opens a school's text only for that school, that generation and that field, and never with learner keys",
    () =>
      scenario(
        Effect.gen(function* () {
          const owner = yield* school("harapan");
          yield* createTenantKey(owner);
          const other = yield* school("tetangga");
          yield* createTenantKey(other);
          const keys = yield* readTenantKeys(owner);
          const otherKeys = yield* readTenantKeys(other);
          const learnerKeys = yield* ensureLearnerKeys(yield* learner("ibu"));
          const sealed = yield* sealText(keys, memory, fact);
          expect(
            (yield* Effect.flip(
              openText(
                { ...keys, tenantId: otherKeys.tenantId },
                memory,
                sealed
              )
            )).reason
          ).toBe("cipher");
          expect(
            (yield* Effect.flip(
              openText({ ...keys, generation: 2 }, memory, sealed)
            )).reason
          ).toBe("cipher");
          expect(
            (yield* Effect.flip(openText(keys, summary, sealed))).reason
          ).toBe("cipher");
          expect(
            (yield* Effect.flip(openText(learnerKeys, memory, sealed))).reason
          ).toBe("cipher");
          // A learner's text never opens with a school's keys either.
          const learnerSealed = yield* sealText(learnerKeys, memory, fact);
          expect(
            (yield* Effect.flip(openText(keys, memory, learnerSealed))).reason
          ).toBe("cipher");
          expect(yield* openText(keys, memory, sealed)).toBe(fact);
        })
      )
  );

  it.effect(
    "blinds a word for one school and one field, the same way every time",
    () =>
      scenario(
        Effect.gen(function* () {
          const owner = yield* school("harapan");
          yield* createTenantKey(owner);
          const other = yield* school("tetangga");
          yield* createTenantKey(other);
          const keys = yield* readTenantKeys(owner);
          const blinded = yield* blindText(keys, memory, "trigon");
          expect(blinded).toMatch(BLIND);
          expect(
            yield* blindText(yield* readTenantKeys(owner), memory, "trigon")
          ).toBe(blinded);
          // Another school, a learner, another field and another word each give another value.
          for (const value of [
            yield* blindText(yield* readTenantKeys(other), memory, "trigon"),
            yield* blindText(
              yield* ensureLearnerKeys(yield* learner("ibu")),
              memory,
              "trigon"
            ),
            yield* blindText(keys, summary, "trigon"),
            yield* blindText(keys, memory, "trigono"),
          ]) {
            expect(value).not.toBe(blinded);
          }
        })
      )
  );
});

describe("vault stored form", () => {
  // The golden values were written by the code before school keys existed. A
  // change to either would strand every learner's sealed rows (ADR 0030).
  it.effect(
    "keeps the stored form of a learner's key and text as it was before school keys",
    () =>
      scenario(
        Effect.gen(function* () {
          const userId = goldenUser;
          yield* (yield* DatabaseWriter).table("vaultKeys").insert({
            createdAt: 1,
            root: "test",
            userId,
            wrapped: bytes(GOLDEN_WRAPPED),
          });
          const keys = yield* readLearnerKeys(userId);
          const sealed = yield* sealText(keys, memory, fact);
          expect(Hex.encode(new Uint8Array(sealed))).toBe(GOLDEN_SEALED);
          expect(yield* openText(keys, memory, bytes(GOLDEN_SEALED))).toBe(
            fact
          );
        })
      )
  );
});

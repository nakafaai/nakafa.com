import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import {
  createTenantKey,
  ensureLearnerKeys,
  readLearnerKeys,
  readTenantKeys,
} from "@repo/backend/confect/vault/keys";
import {
  blindText,
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
import { Effect, Result, Schema } from "effect";
import { Hex } from "effect/encoding";

const summary = { field: "text", table: "ninaSummaries" };
const title = { field: "title", table: "ninaMemories" };
const BLIND = /^[\w-]{22}$/u;
/**
 * A learner whose stored form the golden values below were written for. The
 * test database accepts an ID made of digits and the table name only.
 */
const GOLDEN_USER = "1users";
const goldenUser = Schema.decodeUnknownSync(Id("users"))(GOLDEN_USER);
/** The learner's key under the test root key, as the code wrote it before school keys. */
const GOLDEN_WRAPPED =
  "0132f26fc9be7efd3b0c3840e3209fd9c71d5e151771c32b7dff0825effa85289411a2ae84127036bf2b6ed993451fff581f3fcddbce36fdf71eb6eed6";
/** `fact` sealed under that learner's key, as the code wrote it before school keys. */
const GOLDEN_SEALED =
  "01a2f710347047a93050de3b46e57dc6c74a4994390fd30a7a3f341538b1cabf1d5958fdaf390956073052fca5cd13aced4ff8483c0cc40c058809e1e35dc2d178e0484ae540fc83";

/** The bytes of a stored value, written as hex. */
const bytes = (hex: string) =>
  new Uint8Array(Result.getOrThrow(Hex.decode(hex))).buffer;

describe("vault learner text", () => {
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

  it.effect("opens a text only for the row it was sealed for", () =>
    scenario(
      Effect.gen(function* () {
        const owner = yield* ensureLearnerKeys(yield* learner("owner"));
        const inRow = { ...memory, row: ["thread-a", 2, 1] };
        const sealed = yield* sealText(owner, inRow, fact);
        expect(yield* openText(owner, inRow, sealed)).toBe(fact);
        for (const field of [
          memory,
          { ...memory, row: ["thread-b", 2, 1] },
          { ...memory, row: ["thread-a", 3, 1] },
          { ...memory, row: ["thread-a", 2, 2] },
          { ...memory, row: ["thread-a", "2", 1] },
        ]) {
          expect(
            (yield* Effect.flip(openText(owner, field, sealed))).reason
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
});

describe("vault school text", () => {
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

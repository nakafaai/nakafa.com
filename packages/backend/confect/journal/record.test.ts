import { describe, expect, it } from "@effect/vitest";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { record } from "@repo/backend/confect/journal/record";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { Effect, Schema } from "effect";

const slugOf = Schema.decodeSync(TenantSlug);
const system = { kind: "system" } as const;

/** Two tenants, each with one Person. */
const seed = Effect.fn(function* () {
  const writer = yield* DatabaseWriter;
  const reader = yield* DatabaseReader;
  const personIn = Effect.fn(function* (slug: string) {
    const tenantId = yield* writer.table("tenants").insert({
      kind: "school",
      name: "Sekolah",
      slug: slugOf(slug),
      status: "active",
    });
    const personId = yield* writer.table("tenantPeople").insert({
      account: { state: "unclaimed" },
      kind: "member",
      name: "Person",
      status: "active",
      tenantId,
    });
    return yield* reader.table("tenantPeople").get(personId);
  });
  return { first: yield* personIn("first"), second: yield* personIn("second") };
});

const countEntries = Effect.gen(function* () {
  const confect = yield* Confect;
  return yield* confect.run(
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      return (yield* reader
        .table("journalEntries")
        .index("by_creation_time")
        .take(10)).length;
    }).pipe(Effect.orDie),
    Schema.Finite
  );
});

describe("journal/record", () => {
  it.effect(
    "files each entry under its subject's tenant with the subject's reference",
    () =>
      Effect.gen(function* () {
        const confect = yield* Confect;
        const owners = yield* confect.run(
          Effect.gen(function* () {
            const { first, second } = yield* seed();
            const reader = yield* DatabaseReader;
            const ids = [
              yield* record({
                actor: { id: second._id, kind: "person" },
                change: { type: "person.created" },
                subject: { kind: "person", row: first },
              }),
              yield* record({
                actor: system,
                change: { type: "person.removed" },
                subject: { kind: "person", row: second },
              }),
            ];
            const stored = yield* Effect.forEach(ids, (id) =>
              reader.table("journalEntries").get(id)
            );
            return stored.map((entry) => ({
              owner:
                entry.owner.kind === "tenant" ? entry.owner.tenantId : null,
              subject: entry.subject.id,
              tenant:
                entry.subject.id === first._id
                  ? first.tenantId
                  : second.tenantId,
            }));
          }).pipe(Effect.orDie),
          Schema.mutable(
            Schema.Array(
              Schema.Struct({
                owner: Schema.NullOr(Schema.String),
                subject: Schema.String,
                tenant: Schema.String,
              })
            )
          )
        );
        expect(owners.map((entry) => entry.owner)).toEqual(
          owners.map((entry) => entry.tenant)
        );
        expect(new Set(owners.map((entry) => entry.owner)).size).toBe(2);
      }).pipe(Effect.provide(confectLayer))
  );

  it.effect("leaves no entry when the mutation that recorded it fails", () =>
    Effect.gen(function* () {
      const confect = yield* Confect;
      const exit = yield* confect
        .run(
          Effect.gen(function* () {
            const { first } = yield* seed();
            yield* record({
              actor: system,
              change: { type: "person.created" },
              subject: { kind: "person", row: first },
            });
            return yield* Effect.die("the mutation fails after recording");
          }).pipe(Effect.orDie)
        )
        .pipe(Effect.exit);
      expect(exit._tag).toBe("Failure");
      expect(yield* countEntries).toBe(0);
    }).pipe(Effect.provide(confectLayer))
  );

  it.effect(
    "accepts only the subject kind's own changes and never an owner",
    () =>
      Effect.gen(function* () {
        const confect = yield* Confect;
        const count = yield* confect.run(
          Effect.gen(function* () {
            const { first } = yield* seed();
            yield* record({
              actor: system,
              // @ts-expect-error a unit change cannot describe a person
              change: { type: "unit.created" },
              subject: { kind: "person", row: first },
            });
            yield* record({
              actor: system,
              change: { type: "person.created" },
              // @ts-expect-error the owner comes from the subject, never from the caller
              owner: { kind: "tenant", tenantId: first.tenantId },
              subject: { kind: "person", row: first },
            });
            return 2;
          }).pipe(Effect.orDie),
          Schema.Finite
        );
        expect(count).toBe(2);
      }).pipe(Effect.provide(confectLayer))
  );
});

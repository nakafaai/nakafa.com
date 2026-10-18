import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  type Band,
  DEFAULT_GRADING_SCHEME,
} from "@repo/backend/confect/records/scheme";
import { schemeInForce, schemeOf } from "@repo/backend/confect/records/version";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

/** 2100-01-01, a time no test reaches, so a version that takes effect then is not in force. */
const FAR_FUTURE = 4_102_444_800_000;

/** Stores one version of a school's scheme, from its effective time on. */
const store = Effect.fn("test.records.version.store")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  effectiveFrom: number,
  kktp: number,
  bands: readonly (typeof Band.Type)[] = []
) {
  return yield* (yield* DatabaseWriter).table("gradingSchemes").insert({
    bands,
    effectiveFrom,
    kktp,
    tenantId,
  });
});

/** Every stored version of a school, in the order of their effective time. */
const versionsOf = Effect.fn("test.records.version.versionsOf")(function* (
  tenantId: GenericId.GenericId<"tenants">
) {
  return yield* Effect.flatMap(DatabaseReader, (reader) =>
    reader
      .table("gradingSchemes")
      .index("by_tenantId_and_effectiveFrom", (query) =>
        query.eq("tenantId", tenantId)
      )
      .take(10)
  );
});

describe("records/version in force", () => {
  it.effect(
    "stores the built-in scheme as the school's first version, and names it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const first = yield* fixture.run(schemeInForce(fixture.tenants.nf));
        expect(first.scheme).toEqual(DEFAULT_GRADING_SCHEME);
        expect(yield* fixture.run(versionsOf(fixture.tenants.nf))).toEqual([
          expect.objectContaining({
            _id: first.id,
            bands: [],
            effectiveFrom: 0,
            kktp: 75,
            tenantId: fixture.tenants.nf,
          }),
        ]);
        expect(yield* fixture.run(schemeInForce(fixture.tenants.nf))).toEqual(
          first
        );
      })
  );

  it.effect(
    "takes the newest version already in force, with its bands in order, and names it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.run(store(fixture.tenants.nf, 1, 60));
        const newer = yield* fixture.run(
          store(fixture.tenants.nf, 2, 70, [
            { label: "Baik", minimum: 80 },
            { label: "Cukup", minimum: 60 },
          ])
        );
        expect(yield* fixture.run(schemeInForce(fixture.tenants.nf))).toEqual({
          id: newer,
          scheme: {
            bands: [
              { label: "Cukup", minimum: 60 },
              { label: "Baik", minimum: 80 },
            ],
            kktp: 70,
          },
        });
      })
  );

  it.effect("waits for a version that takes effect later", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const current = yield* fixture.run(store(fixture.tenants.nf, 2, 70));
      yield* fixture.run(store(fixture.tenants.nf, FAR_FUTURE, 90));
      const inForce = yield* fixture.run(schemeInForce(fixture.tenants.nf));
      expect(inForce.id).toBe(current);
      expect(inForce.scheme.kktp).toBe(70);
    })
  );

  it.effect(
    "stores the built-in scheme beside a later version, which then waits for its date",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.run(store(fixture.tenants.nf, FAR_FUTURE, 90));
        const inForce = yield* fixture.run(schemeInForce(fixture.tenants.nf));
        expect(inForce.scheme).toEqual(DEFAULT_GRADING_SCHEME);
        expect(yield* fixture.run(versionsOf(fixture.tenants.nf))).toHaveLength(
          2
        );
      })
  );

  it.effect("reads a stored version by its ID with its bands in order", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const stored = yield* fixture.run(
        store(fixture.tenants.nf, 1, 65, [
          { label: "Baik", minimum: 80 },
          { label: "Cukup", minimum: 60 },
        ])
      );
      expect(yield* fixture.run(schemeOf(stored))).toEqual({
        bands: [
          { label: "Cukup", minimum: 60 },
          { label: "Baik", minimum: 80 },
        ],
        kktp: 65,
      });
    })
  );
});

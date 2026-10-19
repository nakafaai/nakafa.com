import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { denied, nf } from "@repo/backend/test/classroom";
import { journal, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Option } from "effect";

type Fixture = Effect.Success<typeof tenancyFixture>;

const { store } = refs.public.records.schemes;

/** A version of the school's scheme with two bands, from its effective time on. */
const scheme = (effectiveFrom: number, kktp = 70) => ({
  bands: [
    { label: "Cukup", minimum: 60 },
    { label: "Baik", minimum: 80 },
  ],
  effectiveFrom,
  kktp,
  slug: nf,
});

/** The school's Admin stores one version of the scheme. */
const storeAs = (fixture: Fixture, effectiveFrom: number, kktp = 70) =>
  fixture.as("admin").mutation(store, scheme(effectiveFrom, kktp));

describe("records/schemes store", () => {
  it.effect(
    "lets the school's Admin store a dated version with its bands in order, and journals its ID alone",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const stored = yield* fixture.as("admin").mutation(store, {
          ...scheme(1000),
          bands: [
            { label: "Baik", minimum: 80 },
            { label: "Cukup", minimum: 60 },
          ],
        });
        expect(stored).toMatchObject({
          bands: [
            { label: "Cukup", minimum: 60 },
            { label: "Baik", minimum: 80 },
          ],
          effectiveFrom: 1000,
          kktp: 70,
        });
        const entry = Option.getOrUndefined(
          Arr.last(yield* fixture.run(journal))
        );
        expect(entry).toMatchObject({
          actor: { id: fixture.people.admin.personId, kind: "person" },
          subject: { id: fixture.tenants.nf, kind: "tenant" },
        });
        expect(entry?.change).toEqual({
          scheme: stored.id,
          type: "scheme.stored",
        });
      })
  );

  it.effect(
    "refuses a version that does not take effect after the newest one, and writes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* storeAs(fixture, 2000);
        const before = yield* fixture.run(journal);
        const refusals = yield* Effect.all([
          storeAs(fixture, 2000).pipe(Effect.flip),
          storeAs(fixture, 1000).pipe(Effect.flip),
        ]);
        expect(refusals).toMatchObject([
          { _tag: "SchemeNotLater", code: "SCHEME_NOT_LATER" },
          { _tag: "SchemeNotLater", code: "SCHEME_NOT_LATER" },
        ]);
        expect(yield* fixture.run(journal)).toEqual(before);
        expect(yield* storeAs(fixture, 3000)).toMatchObject({
          effectiveFrom: 3000,
        });
      })
  );

  it.effect("refuses the store to anyone but the school's Admin", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const refusals = yield* Effect.all([
        fixture.as("teacher").mutation(store, scheme(1000)).pipe(Effect.flip),
        fixture.as("counselor").mutation(store, scheme(1000)).pipe(Effect.flip),
        fixture.as("student").mutation(store, scheme(1000)).pipe(Effect.flip),
      ]);
      expect(refusals).toMatchObject([
        denied("role"),
        denied("role"),
        denied("role"),
      ]);
    })
  );
});

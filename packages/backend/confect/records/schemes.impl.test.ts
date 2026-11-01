import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import {
  classOf,
  cohort,
  denied,
  firstPage,
  nf,
  period,
  teach,
} from "@repo/backend/test/classroom";
import { journal, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Option } from "effect";

type Fixture = Effect.Success<typeof tenancyFixture>;

const { amend, list, remove, store } = refs.public.records.schemes;
const { enter } = refs.public.records.grades;
const placements = refs.public.tenancy.placements;

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

describe("records/schemes list", () => {
  it.effect(
    "lists the school's versions to its Admin, the newest first, and refuses a teacher",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const first = yield* storeAs(fixture, 1000, 70);
        const second = yield* storeAs(fixture, 2000, 75);
        const page = yield* fixture.as("admin").query(list, {
          paginationOpts: { cursor: null, numItems: 10 },
          slug: nf,
        });
        expect(Arr.map(page.page, (row) => [row.id, row.kktp])).toEqual([
          [second.id, 75],
          [first.id, 70],
        ]);
        const refused = yield* fixture
          .as("teacher")
          .query(list, {
            paginationOpts: { cursor: null, numItems: 10 },
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject(denied("role"));
      })
  );
});

describe("records/schemes amend and remove", () => {
  /** A class with its teacher and a placed student, so a grade can be entered. */
  const graded = Effect.fn("test.records.graded")(function* (fixture: Fixture) {
    const term = yield* period(fixture, fixture.units.smp);
    const group = yield* cohort(fixture, term.id, "X-1");
    const made = yield* classOf(fixture, group.id, "Fisika");
    yield* teach(fixture, made.id, fixture.people.teacher.personId);
    const { personId } = fixture.people.student;
    yield* fixture
      .as("admin")
      .mutation(placements.place, { cohortId: group.id, personId, slug: nf });
    return { classId: made.id, personId };
  });

  it.effect(
    "corrects a version that has judged no grade, keeps its date, and journals it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const stored = yield* storeAs(fixture, 1000);
        const amended = yield* fixture.as("admin").mutation(amend, {
          bands: [{ label: "Baik", minimum: 80 }],
          kktp: 75,
          schemeId: stored.id,
          slug: nf,
        });
        expect(amended).toEqual({
          bands: [{ label: "Baik", minimum: 80 }],
          effectiveFrom: 1000,
          id: stored.id,
          kktp: 75,
          used: false,
        });
        const entry = Option.getOrUndefined(
          Arr.last(yield* fixture.run(journal))
        );
        expect(entry).toMatchObject({
          change: { scheme: stored.id, type: "scheme.amended" },
        });
      })
  );

  it.effect(
    "removes a version that has judged no grade, so the one before it stands",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const earlier = yield* storeAs(fixture, 1000);
        const later = yield* storeAs(fixture, 2000);
        yield* fixture
          .as("admin")
          .mutation(remove, { schemeId: later.id, slug: nf });
        const listed = yield* fixture
          .as("admin")
          .query(list, { ...firstPage, slug: nf });
        expect(Arr.map(listed.page, (row) => row.id)).toEqual([earlier.id]);
        const entry = Option.getOrUndefined(
          Arr.last(yield* fixture.run(journal))
        );
        expect(entry).toMatchObject({
          change: { scheme: later.id, type: "scheme.removed" },
        });
      })
  );

  it.effect(
    "keeps a version that has judged a grade, and says so in the list",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const stored = yield* storeAs(fixture, 1000);
        const { classId, personId } = yield* graded(fixture);
        yield* fixture
          .as("teacher")
          .mutation(enter, { classId, personId, slug: nf, value: 90 });
        const listed = yield* fixture
          .as("admin")
          .query(list, { ...firstPage, slug: nf });
        expect(listed.page[0]?.used).toBe(true);
        const args = { schemeId: stored.id, slug: nf };
        const failures = yield* Effect.all([
          fixture
            .as("admin")
            .mutation(amend, { ...args, bands: [], kktp: 60 })
            .pipe(Effect.flip),
          fixture.as("admin").mutation(remove, args).pipe(Effect.flip),
        ]);
        expect(failures).toMatchObject([
          { _tag: "SchemeUsed" },
          { _tag: "SchemeUsed" },
        ]);
      })
  );

  it.effect("refuses a version of another school as a missing object", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const foreign = yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer.table("gradingSchemes").insert({
            bands: [],
            effectiveFrom: 1,
            kktp: 70,
            tenantId: fixture.tenants.other,
          })
        )
      );
      const refused = yield* fixture
        .as("admin")
        .mutation(remove, { schemeId: foreign, slug: nf })
        .pipe(Effect.flip);
      expect(refused).toMatchObject(denied("resource"));
    })
  );
});

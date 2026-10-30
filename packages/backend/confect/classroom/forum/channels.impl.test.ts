import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { CHANNEL_LIMIT } from "@repo/backend/confect/classroom/forum/channel";
import {
  classOf,
  cohort,
  denied,
  firstPage,
  nf,
  period,
  teach,
} from "@repo/backend/test/classroom";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { add, list } = refs.public.classroom.forum.channels;
const classes = refs.public.classroom.classes;
const grants = refs.public.access.grants;
const placements = refs.public.tenancy.placements;

/** The general channel of every class, as the list shows it. */
const general = {
  id: expect.any(String),
  kind: "general",
  name: "general",
  unread: false,
};

describe("classroom/forum channels", () => {
  it.effect(
    "lists the general channel first, to a student placed in the class",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const made = yield* classOf(fixture, x1.id, "Fisika");
        const { personId } = fixture.people.student;
        yield* fixture.as("admin").mutation(placements.place, {
          cohortId: x1.id,
          personId,
          slug: nf,
        });
        const listed = yield* fixture
          .as("student")
          .query(list, { ...firstPage, classId: made.id, slug: nf });
        expect(listed.page).toEqual([general]);
      })
  );

  it.effect("refuses a student of another class of the school", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const term = yield* period(fixture, fixture.units.smp);
      const x1 = yield* cohort(fixture, term.id, "X-1");
      const x2 = yield* cohort(fixture, term.id, "X-2");
      const placed = yield* classOf(fixture, x1.id, "Fisika");
      const other = yield* classOf(fixture, x2.id, "Biologi");
      const { personId } = fixture.people.student;
      yield* fixture.as("admin").mutation(placements.place, {
        cohortId: x1.id,
        personId,
        slug: nf,
      });
      const listed = yield* fixture
        .as("student")
        .query(list, { ...firstPage, classId: placed.id, slug: nf });
      const refused = yield* fixture
        .as("student")
        .query(list, { ...firstPage, classId: other.id, slug: nf })
        .pipe(Effect.flip);
      expect(listed.page).toEqual([general]);
      expect(refused).toMatchObject(denied("role"));
    })
  );

  it.effect(
    "lets a subject teacher add a topic channel that lists after the general one",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "VII-1");
        const made = yield* classOf(fixture, x1.id, "Fisika");
        yield* teach(fixture, made.id, fixture.people.teacher.personId);
        const added = yield* fixture
          .as("teacher")
          .mutation(add, { classId: made.id, name: "Tugas", slug: nf });
        const listed = yield* fixture
          .as("teacher")
          .query(list, { ...firstPage, classId: made.id, slug: nf });
        expect(added).toEqual({
          id: expect.any(String),
          kind: "topic",
          name: "Tugas",
          unread: false,
        });
        expect(listed.page).toEqual([
          general,
          { id: added.id, kind: "topic", name: "Tugas", unread: false },
        ]);
      })
  );

  it.effect(
    "lets an Admin add a topic channel, and refuses a student's add by role",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const made = yield* classOf(fixture, x1.id, "Fisika");
        const { personId } = fixture.people.student;
        yield* fixture.as("admin").mutation(placements.place, {
          cohortId: x1.id,
          personId,
          slug: nf,
        });
        const added = yield* fixture
          .as("admin")
          .mutation(add, { classId: made.id, name: "Pengumuman", slug: nf });
        const refused = yield* fixture
          .as("student")
          .mutation(add, { classId: made.id, name: "Liar", slug: nf })
          .pipe(Effect.flip);
        expect(added.name).toBe("Pengumuman");
        expect(refused).toMatchObject(denied("role"));
      })
  );

  it.effect(
    "refuses a name that another channel of the class has, compared without case",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "VII-1");
        const made = yield* classOf(fixture, x1.id, "Fisika");
        yield* teach(fixture, made.id, fixture.people.teacher.personId);
        yield* fixture
          .as("teacher")
          .mutation(add, { classId: made.id, name: "Tugas", slug: nf });
        const failures = yield* Effect.all([
          fixture
            .as("teacher")
            .mutation(add, { classId: made.id, name: "TUGAS", slug: nf })
            .pipe(Effect.flip),
          fixture
            .as("teacher")
            .mutation(add, { classId: made.id, name: "General", slug: nf })
            .pipe(Effect.flip),
        ]);
        expect(failures).toMatchObject([
          { _tag: "ChannelNameTaken", code: "CHANNEL_NAME_TAKEN" },
          { _tag: "ChannelNameTaken", code: "CHANNEL_NAME_TAKEN" },
        ]);
      })
  );

  it.effect("refuses a topic past the channel limit", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const term = yield* period(fixture, fixture.units.smp);
      const x1 = yield* cohort(fixture, term.id, "X-1");
      const made = yield* classOf(fixture, x1.id, "Fisika");
      const topics = Arr.makeBy(CHANNEL_LIMIT - 1, (index) => `Topik ${index}`);
      yield* Effect.forEach(
        topics,
        (name) =>
          fixture
            .as("admin")
            .mutation(add, { classId: made.id, name, slug: nf }),
        { discard: true }
      );
      const refused = yield* fixture
        .as("admin")
        .mutation(add, { classId: made.id, name: "Akhir", slug: nf })
        .pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "ChannelLimit" });
    })
  );

  it.effect(
    "refuses a topic in an archived class, and lists its channels to the address that resolves it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "VII-1");
        const made = yield* classOf(fixture, x1.id, "Fisika");
        yield* fixture
          .as("admin")
          .mutation(classes.archive, { classId: made.id, slug: nf });
        const refused = yield* fixture
          .as("admin")
          .mutation(add, { classId: made.id, name: "Tugas", slug: nf })
          .pipe(Effect.flip);
        const resolved = yield* fixture
          .as("admin")
          .query(classes.resolve, { classSlug: made.slug, slug: nf });
        const listed = yield* fixture
          .as("admin")
          .query(list, { ...firstPage, classId: resolved.id, slug: nf });
        expect(refused).toMatchObject(denied("condition"));
        expect(resolved).toMatchObject({ id: made.id, status: "archived" });
        expect(listed.page).toEqual([general]);
      })
  );

  it.effect(
    "ends a teacher's add and read at once when the teacher grant is revoked",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "VII-1");
        const made = yield* classOf(fixture, x1.id, "Fisika");
        const { grantId, personId } = fixture.people.teacher;
        yield* teach(fixture, made.id, personId);
        yield* fixture
          .as("owner")
          .mutation(grants.revoke, { grantId, slug: nf });
        const refusedAdd = yield* fixture
          .as("teacher")
          .mutation(add, { classId: made.id, name: "Tugas", slug: nf })
          .pipe(Effect.flip);
        const refusedRead = yield* fixture
          .as("teacher")
          .query(list, { ...firstPage, classId: made.id, slug: nf })
          .pipe(Effect.flip);
        expect([refusedAdd, refusedRead]).toMatchObject([
          denied("role"),
          denied("role"),
        ]);
      })
  );

  it.effect(
    "ends a student's read of the channels at once when the student grant over the class unit is revoked",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "VII-1");
        const made = yield* classOf(fixture, x1.id, "Fisika");
        const { grantId, personId } = fixture.people.student;
        yield* fixture.as("admin").mutation(placements.place, {
          cohortId: x1.id,
          personId,
          slug: nf,
        });
        yield* fixture
          .as("owner")
          .mutation(grants.revoke, { grantId, slug: nf });
        const refused = yield* fixture
          .as("student")
          .query(list, { ...firstPage, classId: made.id, slug: nf })
          .pipe(Effect.flip);
        expect(refused).toMatchObject(denied("role"));
      })
  );

  it.effect(
    "refuses a class of another school to the channel list and to add, by its ID",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const foreign = yield* fixture.run(
          Effect.gen(function* () {
            const writer = yield* DatabaseWriter;
            const periodId = yield* writer.table("tenantPeriods").insert({
              end: "2026-12-19",
              name: "Asing",
              start: "2026-07-13",
              status: "planned",
              tenantId: fixture.tenants.other,
              unitId: fixture.units.sd,
            });
            const cohortId = yield* writer.table("tenantCohorts").insert({
              grade: 1,
              name: "1A",
              nameKey: "1a",
              periodId,
              status: "active",
              tenantId: fixture.tenants.other,
              unitId: fixture.units.sd,
            });
            return yield* writer.table("classes").insert({
              cohortId,
              createdAt: 0,
              name: "Asing 1A",
              nameKey: "asing 1a",
              periodId,
              slug: "asing-1a",
              status: "active",
              subjectKey: "",
              tenantId: fixture.tenants.other,
              unitId: fixture.units.sd,
              updatedAt: 0,
            });
          })
        );
        const failures = yield* Effect.all([
          fixture
            .as("admin")
            .query(list, { ...firstPage, classId: foreign, slug: nf })
            .pipe(Effect.flip),
          fixture
            .as("admin")
            .mutation(add, { classId: foreign, name: "Asing", slug: nf })
            .pipe(Effect.flip),
        ]);
        expect(failures).toMatchObject([
          denied("resource"),
          denied("resource"),
        ]);
      })
  );
});

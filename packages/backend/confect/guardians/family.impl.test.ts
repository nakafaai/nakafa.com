import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { LINK_TERM } from "@repo/backend/confect/guardians/schema";
import {
  classOf,
  cohort,
  denied,
  firstPage,
  nf,
  period,
  teach,
} from "@repo/backend/test/classroom";
import {
  asStaffSchool,
  type Fixture,
  linkRow,
  NISN,
  setRoster,
  signInGuardian,
  startLink,
} from "@repo/backend/test/guardians";
import {
  defectOf,
  journal,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Duration, Effect, Exit } from "effect";

const { children, confirm, grades, withdraw } = refs.public.guardians.family;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TENANCY_NOW);
});

/** The ledger rows of the school, oldest first. */
const ledger = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("guardianConsents").index("by_creation_time").take(20)
);

/** A school with a key and Staff, a link to the student, and the guardian signed in. */
const linked = Effect.fn("test.guardians.family.linked")(function* (
  fixture: Fixture
) {
  yield* asStaffSchool(fixture);
  const link = yield* startLink(fixture);
  const guardian = yield* signInGuardian(fixture);
  return { guardian: guardian.client, link };
});

describe("guardians/family children and confirm", () => {
  it.effect(
    "lists the guardian's child, and verifies the link with the right NISN",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { guardian, link } = yield* linked(fixture);
        expect(yield* guardian.query(children, { slug: nf })).toEqual([
          {
            linkId: link.id,
            staffCheck: true,
            status: "pending",
            student: { id: fixture.people.student.personId, name: "Student" },
          },
        ]);
        yield* setRoster(fixture, { nisn: NISN, underAgeLimit: true });
        expect(
          (yield* guardian.query(children, { slug: nf }))[0]?.staffCheck
        ).toBe(false);
        expect(
          yield* guardian.mutation(confirm, {
            linkId: link.id,
            nisn: ` ${NISN} `,
            slug: nf,
          })
        ).toBe("verified");
        expect(yield* fixture.run(ledger)).toEqual([
          expect.objectContaining({
            action: "granted",
            checker: link.guardian.id,
            method: "code_nisn",
          }),
        ]);
        const entry = Arr.last(yield* fixture.run(journal));
        expect(entry).toMatchObject({
          _tag: "Some",
          value: { change: { method: "code_nisn", type: "guardian.linked" } },
        });
        expect(
          yield* guardian.mutation(confirm, {
            linkId: link.id,
            nisn: "9999999999",
            slug: nf,
          })
        ).toBe("verified");
      })
  );

  it.effect(
    "refuses a wrong NISN with the words of a wrong code, counts it for Staff, and stops after three",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { guardian, link } = yield* linked(fixture);
        yield* setRoster(fixture, { nisn: NISN, underAgeLimit: true });
        for (const nisn of ["9999999999", "not a nisn", "1111111111"]) {
          expect(
            yield* guardian.mutation(confirm, { linkId: link.id, nisn, slug: nf })
          ).toBe("refused");
        }
        expect((yield* linkRow(fixture, link.id)).mismatches).toBe(3);
        expect(
          yield* guardian.mutation(confirm, {
            linkId: link.id,
            nisn: NISN,
            slug: nf,
          })
        ).toBe("refused");
        const listed = yield* fixture
          .as("counselor")
          .query(refs.public.guardians.links.list, { ...firstPage, slug: nf });
        expect(listed.page[0]).toMatchObject({ mismatches: 3, status: "pending" });
      })
  );

  it.effect(
    "refuses the check without a NISN on file or past the link's term, and counts neither",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { guardian, link } = yield* linked(fixture);
        expect(
          yield* guardian.mutation(confirm, { linkId: link.id, nisn: NISN, slug: nf })
        ).toBe("refused");
        yield* setRoster(fixture, { nisn: NISN, underAgeLimit: true });
        vi.setSystemTime(TENANCY_NOW + Duration.toMillis(LINK_TERM));
        expect(
          yield* guardian.mutation(confirm, { linkId: link.id, nisn: NISN, slug: nf })
        ).toBe("refused");
        expect((yield* linkRow(fixture, link.id)).mismatches).toBe(0);
      })
  );

  it.effect("keeps the check to the guardian of the link alone", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { link } = yield* linked(fixture);
      for (const account of ["owner", "counselor", "student"] as const) {
        expect(
          yield* Effect.flip(
            fixture
              .as(account)
              .mutation(confirm, { linkId: link.id, nisn: NISN, slug: nf })
          )
        ).toMatchObject(denied("role"));
      }
      expect(yield* fixture.as("student").query(children, { slug: nf })).toEqual(
        []
      );
    })
  );
});

describe("guardians/family withdraw", () => {
  it.effect(
    "ends a verified link at once with a withdrawn ledger row and closes the child's grades",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { guardian, link } = yield* linked(fixture);
        yield* fixture
          .as("counselor")
          .mutation(refs.public.guardians.links.verify, {
            linkId: link.id,
            slug: nf,
          });
        const ended = yield* guardian.mutation(withdraw, {
          linkId: link.id,
          slug: nf,
        });
        expect(ended.status).toBe("withdrawn");
        expect(yield* fixture.run(ledger)).toEqual([
          expect.objectContaining({ action: "granted", method: "staff" }),
          expect.objectContaining({
            action: "withdrawn",
            checker: link.guardian.id,
            method: "staff",
          }),
        ]);
        const entry = Arr.last(yield* fixture.run(journal));
        expect(entry).toMatchObject({
          _tag: "Some",
          value: { change: { type: "guardian.withdrawn" } },
        });
        expect(
          yield* Effect.flip(
            guardian.query(grades, { linkId: link.id, slug: nf })
          )
        ).toMatchObject(denied("role"));
        expect(
          yield* guardian.mutation(withdraw, { linkId: link.id, slug: nf })
        ).toEqual(ended);
      })
  );

  it.effect("ends a pending link without a ledger row, since no consent stood", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { guardian, link } = yield* linked(fixture);
      const ended = yield* guardian.mutation(withdraw, {
        linkId: link.id,
        slug: nf,
      });
      expect(ended.status).toBe("withdrawn");
      expect(yield* fixture.run(ledger)).toEqual([]);
    })
  );

  it.effect("fails a verified link that has lost its consent row as a defect", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { guardian, link } = yield* linked(fixture);
      yield* fixture
        .as("counselor")
        .mutation(refs.public.guardians.links.verify, { linkId: link.id, slug: nf });
      yield* fixture.run(
        Effect.gen(function* () {
          const writer = yield* DatabaseWriter;
          const rows = yield* (yield* DatabaseReader)
            .table("guardianConsents")
            .index("by_linkId", (query) => query.eq("linkId", link.id))
            .take(5);
          yield* Effect.forEach(rows, (row) =>
            writer.table("guardianConsents").delete(row._id)
          );
        })
      );
      const exit = yield* Effect.exit(
        guardian.mutation(withdraw, { linkId: link.id, slug: nf })
      );
      expect(Exit.isFailure(exit)).toBe(true);
      expect(defectOf(exit)).toContain("no consent row");
    })
  );
});

describe("guardians/family grades", () => {
  it.effect(
    "opens the child's released grades through a verified link, and never a draft",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { guardian, link } = yield* linked(fixture);
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const fisika = yield* classOf(fixture, x1.id, "Fisika");
        const kimia = yield* classOf(fixture, x1.id, "Kimia");
        yield* teach(fixture, fisika.id, fixture.people.teacher.personId);
        yield* teach(fixture, kimia.id, fixture.people.teacher.personId);
        yield* fixture
          .as("admin")
          .mutation(refs.public.tenancy.placements.place, {
            cohortId: x1.id,
            personId: fixture.people.student.personId,
            slug: nf,
          });
        const enter = refs.public.records.grades.enter;
        const released = yield* fixture.as("teacher").mutation(enter, {
          classId: fisika.id,
          personId: fixture.people.student.personId,
          slug: nf,
          value: 82,
        });
        yield* fixture.as("teacher").mutation(enter, {
          classId: kimia.id,
          personId: fixture.people.student.personId,
          slug: nf,
          value: 60,
        });
        yield* fixture
          .as("teacher")
          .mutation(refs.public.records.grades.release, {
            gradeId: released.id,
            slug: nf,
          });
        expect(
          yield* Effect.flip(guardian.query(grades, { linkId: link.id, slug: nf }))
        ).toMatchObject(denied("role"));
        yield* fixture
          .as("counselor")
          .mutation(refs.public.guardians.links.verify, { linkId: link.id, slug: nf });
        expect(yield* guardian.query(grades, { linkId: link.id, slug: nf })).toEqual([
          {
            className: "Fisika",
            id: released.id,
            kktp: "reached",
            value: 82,
          },
        ]);
      })
  );
});

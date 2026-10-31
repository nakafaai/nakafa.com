import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Nisn } from "@repo/backend/confect/roster/schema";
import { createClient, type Fixture } from "@repo/backend/test/api";
import { cohort, forumClass, nf, period } from "@repo/backend/test/classroom";
import { asStaffSchool } from "@repo/backend/test/guardians";
import {
  journal,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Duration, Effect, Option, Schema } from "effect";

const { enterGrade, importRoster, sweep } = refs.internal.integrations.writes;
const clients = refs.public.integrations.clients;
const DIGEST = "a".repeat(64);
const ROW = {
  cohortName: "VII-A",
  name: "Raka Pratama",
  nisn: Schema.decodeSync(Nisn)("0012345678"),
  underAgeLimit: true,
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TENANCY_NOW);
});

/** A period with a class group, and a client that imports into it. */
const seeded = Effect.fn("test.writes.seeded")(function* (fixture: Fixture) {
  yield* asStaffSchool(fixture);
  const term = yield* period(fixture, fixture.units.smp);
  yield* cohort(fixture, term.id, "VII-A");
  const client = yield* createClient(fixture, ["period.view", "roster.import"]);
  return {
    client,
    request: {
      clientId: client.id,
      digest: DIGEST,
      key: "k1",
      period: term.id,
      rows: [ROW],
    },
  };
});

describe("integrations/writes enterGrade", () => {
  /** A class with the school's student placed in it, and a client that enters its grades. */
  const graded = Effect.fn("test.writes.graded")(function* (fixture: Fixture) {
    yield* asStaffSchool(fixture);
    const term = yield* period(fixture, fixture.units.smp);
    const forum = yield* forumClass(fixture, term.id, "X-1");
    const client = yield* createClient(fixture, ["grade.import"]);
    return {
      classId: forum.classId,
      clientId: client.id,
      personId: fixture.people.student.personId,
      value: 88,
    };
  });

  it.effect(
    "writes a draft a teacher still releases, and a retry leaves one",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const entry = yield* graded(fixture);

        const first = yield* fixture.internal.mutation(enterGrade, entry);
        expect(first).toMatchObject({
          grade: { value: 88 },
          outcome: "entered",
        });
        yield* fixture.internal.mutation(enterGrade, { ...entry, value: 90 });
        const rows = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader
              .table("classGrades")
              .index("by_creation_time")
              .take(5)
              .pipe(Effect.orDie)
          )
        );
        expect(rows).toMatchObject([{ state: "draft", value: 90 }]);
      })
  );

  it.effect("refuses a student outside the class and a released grade", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const entry = yield* graded(fixture);

      expect(
        yield* fixture.internal.mutation(enterGrade, {
          ...entry,
          personId: fixture.people.teacher.personId,
        })
      ).toEqual({ outcome: "notPlaced" });

      yield* fixture.internal.mutation(enterGrade, entry);
      const draft = yield* fixture.run(
        Effect.flatMap(DatabaseReader, (reader) =>
          reader
            .table("classGrades")
            .index("by_creation_time")
            .first()
            .pipe(Effect.map(Option.getOrThrow), Effect.orDie)
        )
      );
      yield* fixture
        .as("teacher")
        .mutation(refs.public.records.grades.release, {
          gradeId: draft._id,
          slug: nf,
        });
      expect(yield* fixture.internal.mutation(enterGrade, entry)).toEqual({
        outcome: "released",
      });
    })
  );

  it.effect(
    "answers forbidden for a list, a class, or an ID it does not open",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const entry = yield* graded(fixture);
        const without = yield* createClient(fixture, ["period.view"]);
        const write = (changed: Partial<typeof entry>) =>
          fixture.internal.mutation(enterGrade, { ...entry, ...changed });
        const refused = { outcome: "forbidden" };

        expect(yield* write({ clientId: without.id })).toEqual(refused);
        expect(yield* write({ classId: "not-an-id" })).toEqual(refused);
        expect(yield* write({ personId: "not-an-id" })).toEqual(refused);
      })
  );
});

describe("integrations/writes importRoster", () => {
  it.effect("imports the rows with the client as the journal's actor", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { client, request } = yield* seeded(fixture);

      expect(yield* fixture.internal.mutation(importRoster, request)).toEqual({
        outcome: "applied",
        summary: { added: 1, changed: 0, skipped: 0 },
      });

      const entries = yield* fixture.run(journal);
      const imported = Arr.findLast(
        entries,
        (entry) => entry.change.type === "roster.imported"
      );
      expect(Option.getOrThrow(imported).actor).toEqual({
        id: client.id,
        kind: "client",
      });
    })
  );

  it.effect(
    "answers a repeat of its key with the first result and writes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { request } = yield* seeded(fixture);
        const first = yield* fixture.internal.mutation(importRoster, request);

        const repeat = yield* fixture.internal.mutation(importRoster, request);

        expect(repeat).toEqual(first);
        const entries = yield* fixture.run(journal);
        expect(
          Arr.filter(
            entries,
            (entry) => entry.change.type === "roster.imported"
          )
        ).toHaveLength(1);
      })
  );

  it.effect("refuses the same key with another request", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { request } = yield* seeded(fixture);
      yield* fixture.internal.mutation(importRoster, request);

      expect(
        yield* fixture.internal.mutation(importRoster, {
          ...request,
          digest: "b".repeat(64),
        })
      ).toEqual({ outcome: "conflict" });
    })
  );

  it.effect("refuses a client whose list opens no import", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { request } = yield* seeded(fixture);
      const client = yield* createClient(fixture, ["period.view"]);

      expect(
        yield* fixture.internal.mutation(importRoster, {
          ...request,
          clientId: client.id,
        })
      ).toEqual({ outcome: "forbidden" });
    })
  );

  it.effect(
    "refuses a client that was revoked after its token was checked",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { client, request } = yield* seeded(fixture);
        yield* fixture
          .as("admin")
          .mutation(clients.revoke, { clientId: client.id, slug: nf });

        expect(yield* fixture.internal.mutation(importRoster, request)).toEqual(
          {
            outcome: "forbidden",
          }
        );
      })
  );
});

describe("integrations/writes sweep", () => {
  it.effect("deletes a record past its term and keeps a fresh one", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { request } = yield* seeded(fixture);
      yield* fixture.internal.mutation(importRoster, request);
      const records = fixture.run(
        Effect.flatMap(DatabaseReader, (reader) =>
          reader
            .table("integrationRequests")
            .index("by_creation_time")
            .take(10)
            .pipe(Effect.orDie)
        )
      );

      yield* fixture.internal.mutation(sweep, {});
      expect(yield* records).toHaveLength(1);

      vi.setSystemTime(TENANCY_NOW + Duration.toMillis(Duration.hours(25)));
      yield* fixture.internal.mutation(sweep, {});
      expect(yield* records).toEqual([]);
    })
  );
});

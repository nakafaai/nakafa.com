import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import {
  classOf,
  cohort,
  firstPage,
  nf,
  period,
  teach,
} from "@repo/backend/test/classroom";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const general = refs.internal.classroom.forum.backfill.general;
const { add, list } = refs.public.classroom.forum.channels;

describe("classroom/forum backfill", () => {
  it.effect(
    "writes the general channel of a class created before channels, once, and places it first",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "VII-1");
        const made = yield* classOf(fixture, x1.id, "Fisika");
        const legacy = yield* fixture.run(
          Effect.gen(function* () {
            const writer = yield* DatabaseWriter;
            return yield* writer.table("classes").insert({
              cohortId: x1.id,
              createdAt: 0,
              name: "Biologi VII-1",
              nameKey: "biologi vii-1",
              periodId: term.id,
              slug: "biologi-vii-1",
              status: "active",
              subject: "Biologi",
              subjectKey: "biologi",
              tenantId: fixture.tenants.nf,
              unitId: fixture.units.smp,
              updatedAt: 0,
            });
          })
        );
        const before = yield* fixture
          .as("admin")
          .query(list, { ...firstPage, classId: legacy, slug: nf });
        yield* teach(fixture, legacy, fixture.people.teacher.personId);
        const topic = yield* fixture
          .as("teacher")
          .mutation(add, { classId: legacy, name: "Praktikum", slug: nf });
        const first = yield* fixture.internal.mutation(general, {});
        const repeat = yield* fixture.internal.mutation(general, {});
        const after = yield* fixture.internal.mutation(general, {
          cursor: first.continueCursor,
        });
        const listed = yield* fixture
          .as("admin")
          .query(list, { ...firstPage, classId: legacy, slug: nf });
        const untouched = yield* fixture
          .as("admin")
          .query(list, { ...firstPage, classId: made.id, slug: nf });
        expect(before.page).toEqual([]);
        expect(first).toEqual({
          continueCursor: expect.any(String),
          created: 1,
          done: true,
        });
        expect(repeat).toEqual({
          continueCursor: expect.any(String),
          created: 0,
          done: true,
        });
        expect(after).toEqual({
          continueCursor: expect.any(String),
          created: 0,
          done: true,
        });
        expect(listed.page).toEqual([
          { id: expect.any(String), kind: "general", name: "general" },
          { id: topic.id, kind: "topic", name: "Praktikum" },
        ]);
        expect(untouched.page).toHaveLength(1);
      })
  );
});

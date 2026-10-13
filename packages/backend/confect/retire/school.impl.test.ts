import { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import {
  leftovers,
  NOW,
  SEEDED,
  seedSchool,
} from "@repo/backend/test/retire/school";
import { Array as Arr, Record as Rec } from "effect";

const erase = Ref.getFunctionReference(refs.internal.retire.school.erase);

/** Calls the migration until it ends, and adds up what each call reports. */
async function pass(
  t: Awaited<ReturnType<typeof seedSchool>>["t"],
  dry: boolean
) {
  let totals: Record<string, number> = {};
  let files = 0;
  let jobs = 0;
  let calls = 0;
  let cursor: string | null = null;
  do {
    const page: Ref.Returns<typeof refs.internal.retire.school.erase> =
      await t.mutation(erase, { cursor, dry });
    totals = Rec.union(totals, page.rows, (left, right) => left + right);
    files += page.files;
    jobs += page.jobs;
    calls += 1;
    cursor = page.next;
  } while (cursor !== null);
  return { calls, files, jobs, rows: totals };
}

describe("retire/school", () => {
  it("counts what a real pass would remove in a dry pass and writes nothing", async () => {
    const { ids, t } = await seedSchool();
    const before = await leftovers(t, ids);
    const counted = await pass(t, true);
    expect(counted.rows).toEqual(SEEDED);
    expect([counted.files, counted.jobs]).toEqual([2, 1]);
    expect(await leftovers(t, ids)).toEqual(before);
    expect(before).toMatchObject({
      byAuthor: 1,
      bySequence: 1,
      job: "pending",
      tables: { schools: 1, schoolMembers: 1 },
    });
    expect(before.attached).not.toBeNull();
    expect(before.pending).not.toBeNull();
    expect(before.preparation).toMatchObject({
      cancellationStartedAt: NOW,
      pendingSchoolNextCursor: "next-school",
      schoolCursor: "school",
      successorCursor: "successor",
    });
  });

  it("removes every row, file, job, aggregate entry, and school field", async () => {
    const { ids, t } = await seedSchool();
    const removed = await pass(t, false);
    expect(removed.rows).toEqual(SEEDED);
    expect([removed.files, removed.jobs]).toEqual([2, 1]);
    const after = await leftovers(t, ids);
    expect(after).toMatchObject({
      attached: null,
      byAuthor: 0,
      bySequence: 0,
      job: "canceled",
      pending: null,
    });
    expect(after.tables).toEqual(Rec.map(after.tables, () => 0));
    expect(after.preparation).not.toHaveProperty("pendingSchoolId");
    expect(after.preparation).not.toHaveProperty("pendingSchoolNextCursor");
    expect(after.preparation).not.toHaveProperty("schoolCursor");
    expect(after.preparation).not.toHaveProperty("successorCursor");
    expect(after.preparation).not.toHaveProperty("cancellationStartedAt");
    expect(after.preparation).toMatchObject({ authId: "retire-owner" });
    // The preparations and their owners stay: only the school fields go.
    expect(
      await t.run((ctx) =>
        ctx.db.query("accountDeletionPreparations").collect()
      )
    ).toHaveLength(2);
  });

  it("ends a dry pass in one call when nothing is left", async () => {
    const { t } = await seedSchool();
    await pass(t, false);
    // The preparations stay, so the last step looks at them and finds no school field.
    expect(await t.mutation(erase, { cursor: null, dry: true })).toEqual({
      files: 0,
      jobs: 0,
      next: null,
      rows: { accountDeletionPreparations: 0 },
    });
  });

  it("ends at once on a deployment that never had a School", async () => {
    const t = createConvexTestWithBetterAuth();
    for (const dry of [true, false]) {
      expect(await t.mutation(erase, { cursor: null, dry })).toEqual({
        files: 0,
        jobs: 0,
        next: null,
        rows: {},
      });
    }
  });

  it("goes on through a table of more rows than one page, dry and real", async () => {
    vi.useFakeTimers();
    const t = createConvexTestWithBetterAuth();
    await t.run(async (ctx) => {
      const owner = await ctx.db.insert("users", {
        authId: "many-owner",
        credits: 0,
        creditsResetAt: 0,
        email: "many@example.com",
        name: "Many",
        plan: "free",
      });
      const schoolId = await ctx.db.insert("schools", {
        city: "Jakarta",
        createdBy: owner,
        currentStudents: 0,
        currentTeachers: 0,
        email: "many@example.com",
        name: "Many",
        province: "DKI Jakarta",
        slug: "many",
        type: "other",
        updatedAt: NOW,
      });
      const classId = await ctx.db.insert("schoolClasses", {
        createdBy: owner,
        image: "logic",
        isArchived: false,
        name: "Many",
        schoolId,
        studentCount: 0,
        subject: "Mathematics",
        teacherCount: 0,
        updatedAt: NOW,
        visibility: "private",
        year: "2026",
      });
      for (const index of Arr.range(1, 20)) {
        await ctx.db.insert("schoolClassMaterialGroups", {
          childGroupCount: 0,
          classId,
          createdBy: owner,
          description: "A material group",
          materialCount: 0,
          name: `Group ${index}`,
          order: index,
          schoolId,
          status: "draft",
          updatedAt: NOW,
        });
      }
      for (const index of Arr.range(1, 10)) {
        await ctx.db.insert("accountDeletionPreparations", {
          authId: `many-${index}`,
          pendingSchoolId: schoolId,
          recoveryGeneration: 0,
          userId: owner,
        });
      }
    });
    const counted = await pass(t, true);
    expect(counted.calls).toBeGreaterThan(4);
    expect(counted.rows).toEqual({
      accountDeletionPreparations: 10,
      schoolClassMaterialGroups: 20,
      schoolClasses: 1,
      schools: 1,
    });
    expect(
      await t.run((ctx) => ctx.db.query("schoolClassMaterialGroups").collect())
    ).toHaveLength(20);
    const removed = await pass(t, false);
    expect(removed.rows).toEqual(counted.rows);
    expect(
      await t.run(async (ctx) => ({
        groups: await ctx.db.query("schoolClassMaterialGroups").collect(),
        held: Arr.filter(
          await ctx.db.query("accountDeletionPreparations").collect(),
          (row) => row.pendingSchoolId !== undefined
        ),
      }))
    ).toEqual({ groups: [], held: [] });
  });

  it("refuses a cursor that it did not make", async () => {
    const { t } = await seedSchool();
    await expect(
      t.mutation(erase, { cursor: "not a cursor", dry: true })
    ).rejects.toThrow();
  });
});

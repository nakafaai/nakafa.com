import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
} from "@effect/vitest";
import { api, internal } from "@repo/backend/convex/_generated/api";
import { createClassFixture } from "@repo/backend/test/classes";

const NOW = Date.UTC(2026, 8, 5, 12);
const mutations = api.classes.materials.mutations;
const publish = internal.classes.materials.mutations.publishMaterialGroup;

const groupInput = {
  name: "Algebra",
  description: "Class exercises",
  status: "draft" as const,
};

describe("class material group lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("creates ordered drafts and published groups, and runs scheduled publication once", async () => {
    const { t, admin, student, users, classId } = await createClassFixture();
    await expect(
      student.mutation(mutations.createMaterialGroup, {
        ...groupInput,
        classId,
      })
    ).rejects.toMatchObject({
      data: { code: "FORBIDDEN" },
    });
    const draftId = await admin.mutation(mutations.createMaterialGroup, {
      ...groupInput,
      classId,
    });
    const publishedId = await admin.mutation(mutations.createMaterialGroup, {
      ...groupInput,
      classId,
      status: "published",
    });
    const scheduledId = await admin.mutation(mutations.createMaterialGroup, {
      ...groupInput,
      classId,
      status: "scheduled",
      scheduledAt: NOW + 1000,
    });
    const initial = await t.query(async (ctx) => ({
      draft: await ctx.db.get("schoolClassMaterialGroups", draftId),
      published: await ctx.db.get("schoolClassMaterialGroups", publishedId),
      scheduled: await ctx.db.get("schoolClassMaterialGroups", scheduledId),
    }));
    expect(initial.draft).toMatchObject({ order: 0, status: "draft" });
    expect(initial.draft?.publishedAt).toBeUndefined();
    expect(initial.published).toMatchObject({
      order: 1,
      status: "published",
      publishedAt: NOW,
      publishedBy: users.admin.userId,
    });
    expect(initial.scheduled).toMatchObject({
      order: 2,
      status: "scheduled",
      scheduledAt: NOW + 1000,
      scheduledJobId: expect.any(String),
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const completed = await t.query((ctx) =>
      ctx.db.get("schoolClassMaterialGroups", scheduledId)
    );
    expect(completed).toMatchObject({
      status: "published",
      publishedAt: NOW + 1000,
      publishedBy: users.admin.userId,
    });
    expect(completed?.scheduledAt).toBeUndefined();
    expect(completed?.scheduledJobId).toBeUndefined();
    await t.mutation(publish, {
      groupId: scheduledId,
      publishedBy: users.admin.userId,
    });
    await expect(
      t.query((ctx) => ctx.db.get("schoolClassMaterialGroups", scheduledId))
    ).resolves.toEqual(completed);
  });

  it("reschedules changed publication times and cancels jobs when a scheduled group becomes a draft", async () => {
    const { t, admin, users, classId } = await createClassFixture();
    const groupId = await admin.mutation(mutations.createMaterialGroup, {
      ...groupInput,
      classId,
    });
    await admin.mutation(mutations.updateMaterialGroup, {
      groupId,
      name: "Renamed",
    });
    await admin.mutation(mutations.updateMaterialGroup, {
      groupId,
      status: "published",
    });
    await admin.mutation(mutations.updateMaterialGroup, {
      groupId,
      description: "Published exercises",
    });
    await expect(
      t.query((ctx) => ctx.db.get("schoolClassMaterialGroups", groupId))
    ).resolves.toMatchObject({
      name: "Renamed",
      description: "Published exercises",
      publishedAt: NOW,
      publishedBy: users.admin.userId,
    });
    await admin.mutation(mutations.updateMaterialGroup, {
      groupId,
      status: "scheduled",
      scheduledAt: NOW + 1000,
    });
    const first = await t.query((ctx) =>
      ctx.db.get("schoolClassMaterialGroups", groupId)
    );
    await admin.mutation(mutations.updateMaterialGroup, {
      groupId,
      name: "Same schedule",
    });
    await expect(
      t.query((ctx) => ctx.db.get("schoolClassMaterialGroups", groupId))
    ).resolves.toMatchObject({
      scheduledJobId: first?.scheduledJobId,
      scheduledAt: NOW + 1000,
    });
    await admin.mutation(mutations.updateMaterialGroup, {
      groupId,
      scheduledAt: NOW + 2000,
    });
    const rescheduled = await t.query((ctx) =>
      ctx.db.get("schoolClassMaterialGroups", groupId)
    );
    expect(rescheduled?.scheduledJobId).toEqual(expect.any(String));
    expect(rescheduled?.scheduledJobId).not.toBe(first?.scheduledJobId);
    await admin.mutation(mutations.updateMaterialGroup, {
      groupId,
      status: "draft",
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const cancelled = await t.query((ctx) =>
      ctx.db.get("schoolClassMaterialGroups", groupId)
    );
    expect(cancelled).toMatchObject({ status: "draft", name: "Same schedule" });
    expect(cancelled?.scheduledAt).toBeUndefined();
    expect(cancelled?.scheduledJobId).toBeUndefined();
  });

  it("clears schedule fields when an internal publication runs before its pending job", async () => {
    const { t, admin, users, classId } = await createClassFixture();
    const groupId = await admin.mutation(mutations.createMaterialGroup, {
      ...groupInput,
      classId,
      status: "scheduled",
      scheduledAt: NOW + 60_000,
    });
    vi.setSystemTime(NOW + 1000);
    await t.mutation(publish, {
      groupId,
      publishedBy: users.admin.userId,
    });
    const published = await t.query((ctx) =>
      ctx.db.get("schoolClassMaterialGroups", groupId)
    );
    expect(published).toMatchObject({
      status: "published",
      publishedAt: NOW + 1000,
      publishedBy: users.admin.userId,
    });
    expect(published?.scheduledAt).toBeUndefined();
    expect(published?.scheduledJobId).toBeUndefined();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await expect(
      t.query((ctx) => ctx.db.get("schoolClassMaterialGroups", groupId))
    ).resolves.toEqual(published);
  });

  it("swaps adjacent groups within their parent and leaves list edges unchanged", async () => {
    const { t, admin, classId } = await createClassFixture();
    const firstId = await admin.mutation(mutations.createMaterialGroup, {
      ...groupInput,
      classId,
    });
    const secondId = await admin.mutation(mutations.createMaterialGroup, {
      ...groupInput,
      classId,
    });
    await admin.mutation(mutations.reorderMaterialGroup, {
      groupId: firstId,
      direction: "up",
    });
    await admin.mutation(mutations.reorderMaterialGroup, {
      groupId: secondId,
      direction: "up",
    });
    await expect(
      t.query(async (ctx) => ({
        first: await ctx.db.get("schoolClassMaterialGroups", firstId),
        second: await ctx.db.get("schoolClassMaterialGroups", secondId),
      }))
    ).resolves.toMatchObject({ first: { order: 1 }, second: { order: 0 } });
    await admin.mutation(mutations.reorderMaterialGroup, {
      groupId: secondId,
      direction: "down",
    });
    await admin.mutation(mutations.reorderMaterialGroup, {
      groupId: secondId,
      direction: "down",
    });
    await expect(
      t.query(async (ctx) => ({
        first: await ctx.db.get("schoolClassMaterialGroups", firstId),
        second: await ctx.db.get("schoolClassMaterialGroups", secondId),
      }))
    ).resolves.toMatchObject({ first: { order: 0 }, second: { order: 1 } });
  });

  it("cancels scheduled deletion handles and tolerates a later duplicate publish call", async () => {
    const { t, admin, users, classId } = await createClassFixture();
    const draftId = await admin.mutation(mutations.createMaterialGroup, {
      ...groupInput,
      classId,
    });
    const scheduledId = await admin.mutation(mutations.createMaterialGroup, {
      ...groupInput,
      classId,
      status: "scheduled",
      scheduledAt: NOW + 1000,
    });
    const scheduled = await t.query((ctx) =>
      ctx.db.get("schoolClassMaterialGroups", scheduledId)
    );
    const scheduledJobId = scheduled?.scheduledJobId;
    assert(scheduledJobId);
    await admin.mutation(mutations.deleteMaterialGroup, { groupId: draftId });
    await admin.mutation(mutations.deleteMaterialGroup, {
      groupId: scheduledId,
    });
    await expect(
      t.query((ctx) =>
        ctx.db.system.get("_scheduled_functions", scheduledJobId)
      )
    ).resolves.toMatchObject({ state: { kind: "canceled" } });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await t.mutation(publish, {
      groupId: scheduledId,
      publishedBy: users.admin.userId,
    });
    await expect(
      t.query((ctx) => ctx.db.query("schoolClassMaterialGroups").collect())
    ).resolves.toEqual([]);
  });
});

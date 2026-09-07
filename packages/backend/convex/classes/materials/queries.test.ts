import { describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import { createClassFixture } from "@repo/backend/test/classes";

const groups = api.classes.materials.queries.getMaterialGroups;

describe("class material group query contracts", () => {
  it("preserves pagination and author joins while restricting student visibility", async () => {
    const { t, admin, student, outsider, users, classId, schoolId } =
      await createClassFixture();
    await t.mutation((ctx) =>
      ctx.db.insert("schoolClassMembers", {
        classId,
        schoolId,
        role: "student",
        updatedAt: Date.now(),
        userId: users.student.userId,
      })
    );
    const create = api.classes.materials.mutations.createMaterialGroup;
    const draftId = await admin.mutation(create, {
      classId,
      description: "Draft exercises",
      name: "Algebra draft",
      status: "draft",
    });
    const publishedId = await admin.mutation(create, {
      classId,
      description: "Published exercises",
      name: "Algebra published",
      status: "published",
    });
    const args = { classId, paginationOpts: { cursor: null, numItems: 10 } };
    const all = await admin.query(groups, args);
    expect(all.isDone).toBe(true);
    expect(all.page.map((group) => group._id)).toEqual([draftId, publishedId]);
    expect(all.page[0]).toMatchObject({
      user: { _id: users.admin.userId },
      publishedByUser: null,
    });
    expect(all.page[1]).toMatchObject({
      user: { _id: users.admin.userId },
      publishedByUser: { _id: users.admin.userId },
    });
    const visible = await student.query(groups, args);
    expect(visible.page.map((group) => group._id)).toEqual([publishedId]);
    expect(await admin.query(groups, { ...args, q: "Algebra" })).toEqual(all);
    expect(await student.query(groups, { ...args, q: "Algebra" })).toEqual(
      visible
    );
    expect((await admin.query(groups, { ...args, q: "  " })).page).toEqual(
      all.page
    );
    await expect(outsider.query(groups, args)).rejects.toMatchObject({
      data: { code: "ACCESS_DENIED" },
    });
  });
});

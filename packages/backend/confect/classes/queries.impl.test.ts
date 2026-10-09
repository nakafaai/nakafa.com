import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  insertClass,
  insertSchool,
} from "@repo/backend/confect/classes/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import { createClassFixture } from "@repo/backend/test/classes";
import { Array as Arr, HashSet } from "effect";

const paginationOpts = {
  cursor: null,
  numItems: 50,
};
const now = Date.UTC(2026, 8, 1);
describe("class queries", () => {
  beforeEach(() => vi.setSystemTime(now));
  it("keeps class search and filters scoped to the member's school", async () => {
    const { t, admin, outsider, users, schoolId, classId } =
      await createClassFixture();
    const archivedId = await t.mutation(async (ctx) => {
      const archived = await insertClass(ctx, {
        now,
        schoolId,
        userId: users.admin.userId,
      });
      await ctx.db.patch("schoolClasses", archived, {
        name: "Algebra archive",
        isArchived: true,
      });
      const foreignSchool = await insertSchool(ctx, {
        now,
        userId: users.outsider.userId,
      });
      await insertClass(ctx, {
        now,
        schoolId: foreignSchool,
        userId: users.outsider.userId,
      });
      return archived;
    });
    for (const q of [undefined, " ", "Algebra"]) {
      const all = await admin.query(api.classes.queries.getClasses, {
        schoolId,
        ...(q === undefined
          ? {}
          : {
              q,
            }),
        paginationOpts,
      });
      expect(HashSet.fromIterable(Arr.map(all.page, (row) => row._id))).toEqual(
        HashSet.fromIterable([classId, archivedId])
      );
      for (const filter of [
        {
          isArchived: false,
        },
        {
          visibility: "private" as const,
        },
        {
          isArchived: false,
          visibility: "private" as const,
        },
      ]) {
        const result = await admin.query(api.classes.queries.getClasses, {
          schoolId,
          ...(q === undefined
            ? {}
            : {
                q,
              }),
          paginationOpts,
          ...filter,
        });
        expect(Arr.map(result.page, (row) => row._id)).toEqual([classId]);
      }
    }
    const first = await admin.query(api.classes.queries.getClasses, {
      schoolId,
      paginationOpts: {
        cursor: null,
        numItems: 1,
      },
    });
    const second = await admin.query(api.classes.queries.getClasses, {
      schoolId,
      paginationOpts: {
        cursor: first.continueCursor,
        numItems: 1,
      },
    });
    expect(
      HashSet.fromIterable(
        Arr.map([...first.page, ...second.page], (row) => row._id)
      )
    ).toEqual(HashSet.fromIterable([classId, archivedId]));
    await expect(
      outsider.query(api.classes.queries.getClasses, {
        schoolId,
        paginationOpts,
      })
    ).rejects.toThrow("ACCESS_DENIED");
  });
  it("separates accessible, join-required, missing and foreign class routes", async () => {
    const { t, admin, student, outsider, classId } = await createClassFixture();
    expect(
      await admin.query(api.classes.queries.getClassRoute, {
        classId,
      })
    ).toMatchObject({
      kind: "accessible",
      class: {
        _id: classId,
      },
      classMembership: {
        role: "teacher",
      },
    });
    expect(
      await student.query(api.classes.queries.getClassRoute, {
        classId,
      })
    ).toMatchObject({
      kind: "joinRequired",
      class: {
        _id: classId,
      },
    });
    await expect(
      outsider.query(api.classes.queries.getClassRoute, {
        classId,
      })
    ).rejects.toThrow("ACCESS_DENIED");
    await expect(
      admin.query(api.classes.queries.getClassRoute, {
        classId: "invalid",
      })
    ).rejects.toThrow("CLASS_NOT_FOUND");
    await t.mutation(async (ctx) => {
      const membership = await ctx.db
        .query("schoolClassMembers")
        .withIndex("by_classId_and_userId", (q) => q.eq("classId", classId))
        .unique();
      if (membership) {
        await ctx.db.delete("schoolClassMembers", membership._id);
      }
    });
    expect(
      await admin.query(api.classes.queries.getClassRoute, {
        classId,
      })
    ).toMatchObject({
      kind: "accessible",
      classMembership: null,
      schoolMembership: {
        role: "admin",
      },
    });
  });
  it("searches people by name or email and preserves teacher priority across search pages", async () => {
    const { t, admin, student, outsider, classId, users } =
      await createClassFixture();
    await admin.mutation(api.classes.mutations.updateClassVisibility, {
      classId,
      visibility: "public",
    });
    await student.mutation(api.classes.mutations.joinPublicClass, {
      classId,
    });
    await t.mutation(async (ctx) => {
      await ctx.db.patch("users", users.admin.userId, {
        name: "Ada Teacher",
        email: "teacher@shared.test",
      });
      await ctx.db.patch("users", users.student.userId, {
        name: "Ben Student",
        email: "student@shared.test",
      });
    });
    for (const q of [undefined, "shared.test"]) {
      const all = await admin.query(api.classes.queries.getPeople, {
        classId,
        paginationOpts,
        ...(q === undefined
          ? {}
          : {
              q,
            }),
      });
      expect(Arr.map(all.page, (row) => row.role)).toEqual([
        "teacher",
        "student",
      ]);
    }
    const byName = await admin.query(api.classes.queries.getPeople, {
      classId,
      paginationOpts,
      q: "  ADA  ",
    });
    expect(Arr.map(byName.page, (row) => row.userId)).toEqual([
      users.admin.userId,
    ]);
    const first = await admin.query(api.classes.queries.getPeople, {
      classId,
      q: "shared",
      paginationOpts: {
        cursor: null,
        numItems: 1,
      },
    });
    expect(first).toMatchObject({
      isDone: false,
      continueCursor: "1",
      page: [
        {
          role: "teacher",
        },
      ],
    });
    const second = await admin.query(api.classes.queries.getPeople, {
      classId,
      q: "shared",
      paginationOpts: {
        cursor: first.continueCursor,
        numItems: 1,
      },
    });
    expect(second).toMatchObject({
      isDone: true,
      page: [
        {
          role: "student",
        },
      ],
    });
    for (const cursor of ["-1", "wrong", "1.2"]) {
      await expect(
        admin.query(api.classes.queries.getPeople, {
          classId,
          q: "shared",
          paginationOpts: {
            cursor,
            numItems: 1,
          },
        })
      ).rejects.toThrow("INVALID_PAGINATION_CURSOR");
    }
    await expect(
      outsider.query(api.classes.queries.getPeople, {
        classId,
        paginationOpts,
      })
    ).rejects.toThrow("ACCESS_DENIED");
    await t.mutation((ctx) =>
      ctx.db.patch("schoolClasses", classId, {
        studentCount: 0,
        teacherCount: 0,
      })
    );
    await expect(
      admin.query(api.classes.queries.getPeople, {
        classId,
        q: "shared",
        paginationOpts,
      })
    ).rejects.toThrow("CLASS_MEMBER_COUNT_EXCEEDED");
    await t.mutation((ctx) =>
      ctx.db.patch("schoolClasses", classId, {
        studentCount: 501,
      })
    );
    await expect(
      admin.query(api.classes.queries.getPeople, {
        classId,
        q: "shared",
        paginationOpts,
      })
    ).rejects.toThrow("CLASS_MEMBER_SEARCH_LIMIT_EXCEEDED");
  });
  it("counts a negative search page size back from the end, as slice did", async () => {
    const { t, admin, student, classId, users } = await createClassFixture();
    await admin.mutation(api.classes.mutations.updateClassVisibility, {
      classId,
      visibility: "public",
    });
    await student.mutation(api.classes.mutations.joinPublicClass, {
      classId,
    });
    await t.mutation(async (ctx) => {
      await ctx.db.patch("users", users.admin.userId, {
        name: "Ada Teacher",
        email: "teacher@shared.test",
      });
      await ctx.db.patch("users", users.student.userId, {
        name: "Ben Student",
        email: "student@shared.test",
      });
    });
    const page = await admin.query(api.classes.queries.getPeople, {
      classId,
      paginationOpts: { ...paginationOpts, numItems: -1 },
      q: "shared",
    });
    expect(Arr.map(page.page, (row) => row.role)).toEqual(["teacher"]);
  });

  it("omits deleted people from both list and search without exposing stale identities", async () => {
    const { t, admin, student, classId, users } = await createClassFixture();
    await admin.mutation(api.classes.mutations.updateClassVisibility, {
      classId,
      visibility: "public",
    });
    await student.mutation(api.classes.mutations.joinPublicClass, {
      classId,
    });
    await t.mutation((ctx) => ctx.db.delete("users", users.student.userId));
    for (const search of [
      {},
      {
        q: "User",
      },
    ]) {
      const result = await admin.query(api.classes.queries.getPeople, {
        classId,
        paginationOpts,
        ...search,
      });
      expect(Arr.map(result.page, (row) => row.userId)).toEqual([
        users.admin.userId,
      ]);
    }
  });
  it("only exposes bounded invitation codes to teachers and administrators", async () => {
    const { t, admin, student, classId, users, schoolId } =
      await createClassFixture();
    await admin.mutation(api.classes.mutations.updateClassVisibility, {
      classId,
      visibility: "public",
    });
    await student.mutation(api.classes.mutations.joinPublicClass, {
      classId,
    });
    const codes = await admin.query(api.classes.queries.getInviteCodes, {
      classId,
    });
    expect(HashSet.fromIterable(Arr.map(codes, (row) => row.role))).toEqual(
      HashSet.fromIterable(["teacher", "student"])
    );
    await expect(
      student.query(api.classes.queries.getInviteCodes, {
        classId,
      })
    ).rejects.toThrow("ACCESS_DENIED");
    await t.mutation(async (ctx) => {
      const membership = await ctx.db
        .query("schoolClassMembers")
        .withIndex("by_classId_and_userId", (q) =>
          q.eq("classId", classId).eq("userId", users.student.userId)
        )
        .unique();
      if (membership) {
        await ctx.db.patch("schoolClassMembers", membership._id, {
          role: "teacher",
          teacherRole: "assistant",
        });
      }
    });
    expect(
      await student.query(api.classes.queries.getInviteCodes, {
        classId,
      })
    ).toEqual(codes);
    expect(
      await student.query(api.classes.queries.getClassRoute, {
        classId,
      })
    ).toMatchObject({
      kind: "accessible",
      classMembership: {
        role: "teacher",
      },
    });
    await t.mutation((ctx) =>
      ctx.db.insert("schoolClassInviteCodes", {
        classId,
        schoolId,
        code: "duplicate",
        role: "student",
        createdBy: users.admin.userId,
        enabled: true,
        currentUsage: 0,
        updatedAt: now,
      })
    );
    await expect(
      admin.query(api.classes.queries.getInviteCodes, {
        classId,
      })
    ).rejects.toThrow("CLASS_INVITE_CODE_LIMIT_EXCEEDED");
  });
});

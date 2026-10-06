import { Ref } from "@confect/core";
import { assert, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { createClassFixture } from "@repo/backend/test/classes";
import { Array as Arr } from "effect";

const roster = Ref.getFunctionReference(refs.public.classes.roster.list);
const now = Date.UTC(2026, 8, 1);

// Better Auth's component requires its official convex-test registration.
// Calls use the generated Confect function reference at the SDK transport seam.
async function seedPeople(
  fixture: Awaited<ReturnType<typeof createClassFixture>>,
  count: number
) {
  return await fixture.t.mutation(async (ctx) => {
    let rows: {
      userId: Id<"users">;
      memberId: Id<"schoolClassMembers">;
    }[] = [];
    for (let index = 0; index < count; index += 1) {
      const userId = await ctx.db.insert("users", {
        authId: `roster-${index}`,
        name: `Person ${index}`,
        email: `person-${index}@roster.test`,
        credits: 10,
        creditsResetAt: now,
        plan: "free",
      });
      const memberId = await ctx.db.insert("schoolClassMembers", {
        classId: fixture.classId,
        schoolId: fixture.schoolId,
        userId,
        role: index % 20 === 0 ? "teacher" : "student",
        updatedAt: now,
      });
      rows = Arr.append(rows, {
        userId,
        memberId,
      });
    }
    return rows;
  });
}
describe("class roster stream", () => {
  beforeEach(() => vi.setSystemTime(now));
  it("orders teachers before students across every page and omits deleted identities", async () => {
    const fixture = await createClassFixture();
    const seeded = await seedPeople(fixture, 66);
    const removed = seeded[0];
    assert(removed);
    await fixture.t.mutation((ctx) => ctx.db.delete("users", removed.userId));
    let people: Ref.Returns<typeof refs.public.classes.roster.list>["page"] =
      [];
    let cursor: string | null = null;
    for (let pageIndex = 0; pageIndex < 10; pageIndex += 1) {
      const page: Ref.Returns<typeof refs.public.classes.roster.list> =
        await fixture.admin
          .query(roster, {
            classId: fixture.classId,
            paginationOpts: {
              cursor,
              numItems: 17,
            },
          })
          .then((value) =>
            Ref.decodeReturnsSync(refs.public.classes.roster.list, value)
          );
      people = Arr.appendAll(people, page.page);
      if (page.isDone) {
        break;
      }
      expect(page.continueCursor).not.toBe(cursor);
      cursor = page.continueCursor;
    }
    expect(people).toHaveLength(66);
    expect(new Set(Arr.map(people, (row) => row._id)).size).toBe(people.length);
    expect(Arr.map(people, (row) => row.userId)).not.toContain(removed.userId);
    const teacherCount = Arr.filter(
      people,
      (row) => row.role === "teacher"
    ).length;
    expect(teacherCount).toBe(4);
    expect(
      Arr.every(people.slice(0, teacherCount), (row) => row.role === "teacher")
    ).toBe(true);
    expect(
      Arr.every(people.slice(teacherCount), (row) => row.role === "student")
    ).toBe(true);
  });
  it("continues bounded sparse searches through empty pages beyond 500 members", async () => {
    const fixture = await createClassFixture();
    const seeded = await seedPeople(fixture, 502);
    const selected = seeded[251];
    assert(selected);
    await fixture.t.mutation((ctx) =>
      ctx.db.patch("users", selected.userId, {
        name: "Needle Person",
      })
    );
    for (const q of ["  NEEDLE  ", "person-251@roster.test", "absent-name"]) {
      let cursor: string | null = null;
      let done = false;
      let emptyPages = 0;
      let people: Ref.Returns<typeof refs.public.classes.roster.list>["page"] =
        [];
      for (let pageIndex = 0; pageIndex < 40 && !done; pageIndex += 1) {
        const page: Ref.Returns<typeof refs.public.classes.roster.list> =
          await fixture.admin
            .query(roster, {
              classId: fixture.classId,
              q,
              paginationOpts: {
                cursor,
                numItems: 10,
                maximumRowsRead: 80,
              },
            })
            .then((value) =>
              Ref.decodeReturnsSync(refs.public.classes.roster.list, value)
            );
        people = Arr.appendAll(people, page.page);
        if (page.page.length === 0 && !page.isDone) {
          emptyPages += 1;
        }
        done = page.isDone;
        if (!done) {
          expect(page.continueCursor).not.toBe(cursor);
        }
        cursor = page.continueCursor;
      }
      expect(done).toBe(true);
      expect(emptyPages).toBeGreaterThan(0);
      expect(Arr.map(people, (row) => row.userId)).toEqual(
        q === "absent-name" ? [] : [selected.userId]
      );
    }
  });
  it("pins loaded ranges across removal and insertion without gaps or duplicates", async () => {
    const fixture = await createClassFixture();
    await seedPeople(fixture, 12);
    const first = await fixture.admin
      .query(roster, {
        classId: fixture.classId,
        paginationOpts: {
          cursor: null,
          numItems: 4,
        },
      })
      .then((value) =>
        Ref.decodeReturnsSync(refs.public.classes.roster.list, value)
      );
    expect(first.isDone).toBe(false);
    const removed = first.page[0];
    assert(removed);
    await fixture.t.mutation((ctx) =>
      ctx.db.delete("schoolClassMembers", removed._id)
    );
    await fixture.t.mutation((ctx) =>
      ctx.db.insert("schoolClassMembers", {
        classId: fixture.classId,
        schoolId: fixture.schoolId,
        userId: fixture.users.outsider.userId,
        role: "teacher",
        updatedAt: now,
      })
    );
    const pinned = await fixture.admin
      .query(roster, {
        classId: fixture.classId,
        paginationOpts: {
          cursor: null,
          endCursor: first.continueCursor,
          numItems: 4,
        },
      })
      .then((value) =>
        Ref.decodeReturnsSync(refs.public.classes.roster.list, value)
      );
    const rest = await fixture.admin
      .query(roster, {
        classId: fixture.classId,
        paginationOpts: {
          cursor: first.continueCursor,
          numItems: 20,
        },
      })
      .then((value) =>
        Ref.decodeReturnsSync(refs.public.classes.roster.list, value)
      );
    const complete = await fixture.admin
      .query(roster, {
        classId: fixture.classId,
        paginationOpts: {
          cursor: null,
          numItems: 30,
        },
      })
      .then((value) =>
        Ref.decodeReturnsSync(refs.public.classes.roster.list, value)
      );
    expect(Arr.map([...pinned.page, ...rest.page], (row) => row._id)).toEqual(
      Arr.map(complete.page, (row) => row._id)
    );
    expect(complete.page).toHaveLength(13);
  });
  it("rejects foreign viewers and invalid cursors before exposing roster identities", async () => {
    const fixture = await createClassFixture();
    await expect(
      fixture.outsider.query(roster, {
        classId: fixture.classId,
        paginationOpts: {
          cursor: null,
          numItems: 10,
        },
      })
    ).rejects.toMatchObject({
      data: {
        code: "ACCESS_DENIED",
      },
    });
    for (const cursor of ["wrong", "-1", "1"]) {
      await expect(
        fixture.admin.query(roster, {
          classId: fixture.classId,
          paginationOpts: {
            cursor,
            numItems: 10,
          },
        })
      ).rejects.toMatchObject({
        data: {
          paginationError: "InvalidCursor",
        },
      });
    }
  });
});

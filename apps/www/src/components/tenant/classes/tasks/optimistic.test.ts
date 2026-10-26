import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Option, Schema } from "effect";
import {
  type ClassTask,
  rescheduleUpdate,
  scoreUpdate,
  submitUpdate,
  type TaskWork,
} from "@/components/tenant/classes/tasks/optimistic";

const slug = Schema.decodeSync(TenantSlug)("sekolah");
const classId = Schema.decodeUnknownSync(Id("classes"))("class-1");
const taskOf = Schema.decodeUnknownSync(Id("classroomTasks"));
const workOf = Schema.decodeUnknownSync(Id("classroomSubmissions"));
const personId = Schema.decodeUnknownSync(Id("tenantPeople"))("person-1");

/** A task of the class at `address`, due at 100. */
const task = (address: string, mine: ClassTask["mine"]): ClassTask => ({
  deadline: 100,
  handedIn: 3,
  id: taskOf(address),
  latePolicy: "accept",
  mine,
  points: 50,
  slug: address,
  text: "Kerjakan.",
  title: address,
});

/** A student's work with the given points. */
const work = (id: string, score: number | null): TaskWork => ({
  id: workOf(id),
  late: false,
  person: { id: personId, name: "Raka" },
  score,
  text: "Jawaban.",
  updatedAt: 1,
});

/** A store that holds the given queries of each reference, as pairs, and records what is written. */
const storeByRef = (queries: readonly (readonly [unknown, unknown[]])[]) => {
  const getAllQueries = vi.fn();
  getAllQueries.mockImplementation((ref: unknown) =>
    Option.getOrElse(
      Option.map(
        Arr.findFirst(queries, ([key]) => key === ref),
        ([, rows]) => rows
      ),
      () => []
    )
  );
  const setQuery = vi.fn();
  return {
    localStore: { getAllQueries, getQuery: vi.fn(), setQuery },
    setQuery,
  };
};

const pageArgs = { classId, paginationOpts: { cursor: null, numItems: 20 }, slug };

describe("task optimistic updates", () => {
  it("hands work in on the task's page and in the list, counting a first hand-in and marking late work", () => {
    const fresh = task("ringkasan", null);
    const other = task("lain", null);
    const { localStore, setQuery } = storeByRef([
      [
        classroom.tasks.get,
        [
          { args: { classId, slug, task: "ringkasan" }, value: Option.some(fresh) },
          { args: { classId, slug, task: "lain" }, value: Option.some(other) },
          { args: { classId, slug, task: "ringkasan" }, value: Option.none() },
        ],
      ],
      [
        classroom.tasks.list,
        [
          {
            args: pageArgs,
            value: Option.some({ isDone: true, page: [fresh, other] }),
          },
          { args: pageArgs, value: Option.some({ isDone: true, page: [other] }) },
          { args: pageArgs, value: Option.none() },
        ],
      ],
    ]);

    submitUpdate(150)(localStore, { classId, slug, task: "ringkasan", text: "x" });

    const handed = {
      ...fresh,
      handedIn: 4,
      mine: { late: true, score: null, updatedAt: 150 },
    };
    expect(setQuery.mock.calls).toEqual([
      [classroom.tasks.get, { classId, slug, task: "ringkasan" }, Option.some(handed)],
      [
        classroom.tasks.list,
        pageArgs,
        Option.some({ isDone: true, page: [handed, other] }),
      ],
    ]);

    const again = storeByRef([
      [
        classroom.tasks.get,
        [
          {
            args: { classId, slug, task: "ringkasan" },
            value: Option.some(
              task("ringkasan", { late: false, score: 40, updatedAt: 1 })
            ),
          },
        ],
      ],
    ]);
    submitUpdate(50)(again.localStore, { classId, slug, task: "ringkasan", text: "y" });
    expect(again.setQuery.mock.calls[0]?.[2]).toEqual(
      Option.some({
        ...task("ringkasan", null),
        mine: { late: false, score: 40, updatedAt: 50 },
      })
    );
  });

  it("moves a deadline and gives work its points at once", () => {
    const moved = storeByRef([
      [
        classroom.tasks.get,
        [{ args: { classId, slug, task: "ringkasan" }, value: Option.some(task("ringkasan", null)) }],
      ],
    ]);
    rescheduleUpdate(moved.localStore, {
      classId,
      deadline: 900,
      slug,
      task: "ringkasan",
    });
    expect(moved.setQuery.mock.calls[0]?.[2]).toEqual(
      Option.some({ ...task("ringkasan", null), deadline: 900 })
    );

    const scored = storeByRef([
      [
        classroom.tasks.submissions,
        [
          {
            args: { ...pageArgs, task: "ringkasan" },
            value: Option.some({ isDone: true, page: [work("a", null), work("b", 3)] }),
          },
          {
            args: { ...pageArgs, task: "lain" },
            value: Option.some({ isDone: true, page: [work("c", null)] }),
          },
          { args: { ...pageArgs, task: "ringkasan" }, value: Option.none() },
        ],
      ],
    ]);
    scoreUpdate(scored.localStore, {
      classId,
      points: 45,
      slug,
      submissionId: workOf("a"),
    });
    expect(scored.setQuery.mock.calls).toEqual([
      [
        classroom.tasks.submissions,
        { ...pageArgs, task: "ringkasan" },
        Option.some({ isDone: true, page: [work("a", 45), work("b", 3)] }),
      ],
    ]);
  });
});

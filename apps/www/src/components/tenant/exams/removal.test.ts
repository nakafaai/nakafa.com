import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Option, Schema } from "effect";
import { removeExamUpdate } from "@/components/tenant/exams/removal";

const examIdOf = Schema.decodeUnknownSync(Id("exams"));
const slug = Schema.decodeSync(TenantSlug)("sekolah");
const gone = { id: examIdOf("exam-gone"), title: "Hapus" };
const kept = { id: examIdOf("exam-kept"), title: "Tetap" };

/** A store that holds the given list pages, and records what is written. */
const storeOf = (pages: unknown[]) => {
  const getAllQueries = vi.fn();
  getAllQueries.mockReturnValue(pages);
  const getQuery = vi.fn();
  const setQuery = vi.fn();
  return { localStore: { getAllQueries, getQuery, setQuery }, setQuery };
};

describe("removeExamUpdate", () => {
  it("takes the exam out of every loaded list page, and leaves a page still loading", () => {
    const firstArgs = { paginationOpts: { cursor: null, numItems: 20 }, slug };
    const nextArgs = { paginationOpts: { cursor: "next", numItems: 20 }, slug };
    const { localStore, setQuery } = storeOf([
      {
        args: firstArgs,
        value: Option.some({ isDone: false, page: [kept, gone] }),
      },
      { args: nextArgs, value: Option.none() },
    ]);

    removeExamUpdate(localStore, { examId: gone.id, slug });

    expect(setQuery.mock.calls).toEqual([
      [
        exams.exams.list,
        firstArgs,
        Option.some({ isDone: false, page: [kept] }),
      ],
    ]);
  });

  it("writes nothing when the store holds no list", () => {
    const { localStore, setQuery } = storeOf([]);

    removeExamUpdate(localStore, { examId: gone.id, slug });

    expect(setQuery).not.toHaveBeenCalled();
  });
});

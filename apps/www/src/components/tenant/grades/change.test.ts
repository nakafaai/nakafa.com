import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Option, Schema } from "effect";
import {
  enterChange,
  releaseChange,
  type SheetLine,
} from "@/components/tenant/grades/change";

const slug = Schema.decodeSync(TenantSlug)("sekolah");
const classId = Schema.decodeUnknownSync(Id("classes"))("class-1");
const otherClass = Schema.decodeUnknownSync(Id("classes"))("class-2");
const personOf = Schema.decodeUnknownSync(Id("tenantPeople"));
const gradeOf = Schema.decodeUnknownSync(Id("classGrades"));
const raka = personOf("raka");
const sari = personOf("sari");
const scheme = { bands: [{ label: "Baik", minimum: 80 }], kktp: 75 };

/** A line of the gradebook with the grade it holds. */
const line = (personId: typeof raka, grade: SheetLine["grade"]): SheetLine => ({
  grade,
  student: { id: personId, name: personId === raka ? "Raka" : "Sari" },
});

/** A released grade of Sari, which no entry changes. */
const released: SheetLine["grade"] = {
  classId,
  id: gradeOf("grade-sari"),
  kktp: "notReached",
  personId: sari,
  state: "released",
  value: 60,
};

/** The arguments of one page of a class's gradebook. */
const pageArgs = (forClass: typeof classId) => ({
  classId: forClass,
  paginationOpts: { cursor: null, numItems: 50 },
  slug,
});

/** A store that holds the given pages and records what is written. */
const storeOf = (pages: unknown[]) => {
  const getAllQueries = vi.fn();
  getAllQueries.mockReturnValue(pages);
  const setQuery = vi.fn();
  return {
    localStore: { getAllQueries, getQuery: vi.fn(), setQuery },
    setQuery,
  };
};

/** The page that one recorded write stored. */
const writtenPage = (setQuery: ReturnType<typeof vi.fn>) =>
  Option.getOrThrow(setQuery.mock.calls[0]?.[2]).page;

describe("enterChange", () => {
  it("shows an entered value as a draft judged by the scheme, on the pages of its own class only", () => {
    const { localStore, setQuery } = storeOf([
      {
        args: pageArgs(classId),
        value: Option.some({ isDone: true, page: [line(raka, null), line(sari, released)] }),
      },
      { args: pageArgs(otherClass), value: Option.some({ isDone: true, page: [] }) },
      { args: pageArgs(classId), value: Option.none() },
    ]);
    enterChange(scheme)(localStore, { classId, personId: raka, slug, value: 85 });
    expect(setQuery).toHaveBeenCalledTimes(1);
    const [entered, kept] = writtenPage(setQuery);
    expect(entered.grade).toMatchObject({
      band: "Baik",
      kktp: "reached",
      state: "draft",
      value: 85,
    });
    expect(kept).toEqual(line(sari, released));
  });

  it("keeps a released grade, and the ID of a draft it replaces", () => {
    const draft = { ...released, id: gradeOf("grade-raka"), personId: raka, state: "draft" as const };
    const { localStore, setQuery } = storeOf([
      {
        args: pageArgs(classId),
        value: Option.some({ isDone: true, page: [line(raka, draft), line(sari, released)] }),
      },
    ]);
    enterChange(scheme)(localStore, { classId, personId: raka, slug, value: 70 });
    enterChange(scheme)(localStore, { classId, personId: sari, slug, value: 90 });
    const [replaced] = writtenPage(setQuery);
    expect(replaced.grade).toMatchObject({ id: draft.id, kktp: "notReached", value: 70 });
    const second = Option.getOrThrow(setQuery.mock.calls[1]?.[2]).page;
    expect(second[1]).toEqual(line(sari, released));
  });
});

describe("releaseChange", () => {
  it("shows a draft as released, and leaves a line without a grade as it is", () => {
    const draft = { ...released, id: gradeOf("grade-raka"), personId: raka, state: "draft" as const };
    const { localStore, setQuery } = storeOf([
      {
        args: pageArgs(classId),
        value: Option.some({ isDone: true, page: [line(raka, draft), line(sari, null)] }),
      },
    ]);
    releaseChange(classId, raka)(localStore, { gradeId: draft.id, slug });
    releaseChange(classId, sari)(localStore, { gradeId: draft.id, slug });
    expect(writtenPage(setQuery)[0].grade).toMatchObject({ state: "released" });
    expect(Option.getOrThrow(setQuery.mock.calls[1]?.[2]).page[1]).toEqual(line(sari, null));
  });
});

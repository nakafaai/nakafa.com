import {
  getAllGradesWithSubjects,
  getCategoryGrades,
  getGradeNonNumeric,
  getGradePath,
  getGradeSubjects,
  parseGrade,
} from "@repo/contents/_lib/subject/grade";
import { Effect, Option } from "effect";
import { describe, expect, it } from "vitest";

describe("subject grade helpers", () => {
  it("builds grade routes and resolves grade labels", async () => {
    expect(getGradePath("high-school", "10")).toBe("/subject/high-school/10");
    expect(Option.getOrUndefined(getGradeNonNumeric("bachelor"))).toBe(
      "bachelor"
    );
    expect(Option.isNone(getGradeNonNumeric("10"))).toBe(true);
    expect(await Effect.runPromise(getCategoryGrades("middle-school"))).toEqual(
      ["7", "8", "9"]
    );
  });

  it("derives available grades from content folders", async () => {
    expect(
      await Effect.runPromise(getCategoryGrades("elementary-school"))
    ).toEqual([]);
    expect(await Effect.runPromise(getCategoryGrades("university"))).toEqual([
      "bachelor",
    ]);
  });

  it("parses valid grade segments and rejects invalid ones", () => {
    expect(Option.getOrUndefined(parseGrade("10"))).toBe("10");
    expect(Option.getOrUndefined(parseGrade("bachelor"))).toBe("bachelor");
    expect(Option.isNone(parseGrade("not-a-grade"))).toBe(true);
  });
});

describe("getGradeSubjects", () => {
  it("derives high-school subjects from existing material folders", async () => {
    expect(
      await Effect.runPromise(getGradeSubjects("high-school", "10"))
    ).toEqual([
      {
        href: "/subject/high-school/10/mathematics",
        label: "mathematics",
      },
      {
        href: "/subject/high-school/10/physics",
        label: "physics",
      },
      {
        href: "/subject/high-school/10/chemistry",
        label: "chemistry",
      },
      {
        href: "/subject/high-school/10/biology",
        label: "biology",
      },
      {
        href: "/subject/high-school/10/history",
        label: "history",
      },
    ]);
  });

  it("does not advertise subject materials without backing folders", async () => {
    const subjects = await Effect.runPromise(
      getGradeSubjects("university", "bachelor")
    );
    const hrefs = subjects.map((subject) => subject.href);

    expect(subjects).toEqual([
      {
        href: "/subject/university/bachelor/ai-ds",
        label: "ai-ds",
      },
    ]);
    expect(hrefs).not.toContain(
      "/subject/university/bachelor/computer-science"
    );
  });

  it("returns no subjects when a grade has no material folders", async () => {
    expect(
      await Effect.runPromise(getGradeSubjects("elementary-school", "1"))
    ).toEqual([]);
  });
});

describe("getAllGradesWithSubjects", () => {
  it("keeps grade listings aligned with folder-backed subject routes", async () => {
    const grades = await Effect.runPromise(
      getAllGradesWithSubjects(["high-school"])
    );
    const grade10 = grades.find((grade) => grade.href.endsWith("/10"));

    expect(grade10?.subjects).toEqual(
      await Effect.runPromise(getGradeSubjects("high-school", "10"))
    );
  });

  it("loads every configured category when no category filter is provided", async () => {
    const grades = await Effect.runPromise(getAllGradesWithSubjects());
    const bachelor = grades.find((grade) => grade.href.endsWith("/bachelor"));

    expect(grades).toHaveLength(7);
    expect(bachelor?.label).toBe("bachelor");
    expect(bachelor?.subjects).toEqual(
      await Effect.runPromise(getGradeSubjects("university", "bachelor"))
    );
  });
});

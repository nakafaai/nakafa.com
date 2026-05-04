import {
  getAllGradesWithSubjects,
  getCategoryGrades,
  getGradeNonNumeric,
  getGradePath,
  getGradeSubjects,
  parseGrade,
} from "@repo/contents/_lib/subject/grade";
import { describe, expect, it } from "vitest";

describe("subject grade helpers", () => {
  it("builds grade routes and resolves grade labels", () => {
    expect(getGradePath("high-school", "10")).toBe("/subject/high-school/10");
    expect(getGradeNonNumeric("bachelor")).toBe("bachelor");
    expect(getGradeNonNumeric("10")).toBeUndefined();
    expect(getCategoryGrades("middle-school")).toEqual(["7", "8", "9"]);
  });

  it("derives available grades from content folders", () => {
    expect(getCategoryGrades("elementary-school")).toEqual([]);
    expect(getCategoryGrades("university")).toEqual(["bachelor"]);
  });

  it("parses valid grade segments and rejects invalid ones", () => {
    expect(parseGrade("10")).toBe("10");
    expect(parseGrade("bachelor")).toBe("bachelor");
    expect(parseGrade("not-a-grade")).toBeNull();
  });
});

describe("getGradeSubjects", () => {
  it("derives high-school subjects from existing material folders", () => {
    expect(getGradeSubjects("high-school", "10")).toEqual([
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

  it("does not advertise subject materials without backing folders", () => {
    const subjects = getGradeSubjects("university", "bachelor");
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

  it("returns no subjects when a grade has no material folders", () => {
    expect(getGradeSubjects("elementary-school", "1")).toEqual([]);
  });
});

describe("getAllGradesWithSubjects", () => {
  it("keeps grade listings aligned with folder-backed subject routes", () => {
    const grades = getAllGradesWithSubjects(["high-school"]);
    const grade10 = grades.find((grade) => grade.href.endsWith("/10"));

    expect(grade10?.subjects).toEqual(getGradeSubjects("high-school", "10"));
  });

  it("loads every configured category when no category filter is provided", () => {
    const grades = getAllGradesWithSubjects();
    const bachelor = grades.find((grade) => grade.href.endsWith("/bachelor"));

    expect(grades).toHaveLength(7);
    expect(bachelor?.label).toBe("bachelor");
    expect(bachelor?.subjects).toEqual(
      getGradeSubjects("university", "bachelor")
    );
  });
});

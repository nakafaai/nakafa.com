// @vitest-environment node

import { describe, expect, it } from "vitest";
import { readCurriculumSeoContext } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/seo";
import {
  testProgramClass,
  testProgramRoot,
  testProgramSubject,
} from "@/test/content-program";

describe("curriculum route SEO context", () => {
  it("keeps root curriculum metadata scoped to the program title", () => {
    expect(readCurriculumSeoContext(testProgramRoot, [])).toMatchObject({
      type: "curriculum-context",
      level: "track",
      parent: undefined,
      program: undefined,
      data: {
        title: testProgramRoot.title,
      },
    });
  });

  it("includes parent and program context for nested curriculum pages", () => {
    expect(
      readCurriculumSeoContext(testProgramSubject, [
        testProgramRoot,
        testProgramClass,
      ])
    ).toMatchObject({
      type: "curriculum-context",
      level: "subject",
      parent: testProgramClass.title,
      program: testProgramRoot.title,
      data: {
        title: testProgramSubject.title,
      },
    });
  });

  it("does not duplicate the root program as both parent and program", () => {
    expect(
      readCurriculumSeoContext(testProgramClass, [testProgramRoot])
    ).toMatchObject({
      level: "class",
      parent: testProgramRoot.title,
      program: undefined,
      data: {
        title: testProgramClass.title,
      },
    });
  });

  it("does not duplicate the program title when the current route already uses it", () => {
    expect(
      readCurriculumSeoContext(
        { ...testProgramClass, title: testProgramRoot.title },
        [testProgramRoot]
      )
    ).toMatchObject({
      parent: testProgramRoot.title,
      program: undefined,
    });
  });
});

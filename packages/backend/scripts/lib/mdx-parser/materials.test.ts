import path from "node:path";
import {
  parseExerciseMaterialFile,
  parseSubjectMaterialFile,
} from "@repo/backend/scripts/lib/mdx-parser/materials";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

/** Resolves a test fixture path inside the shared contents package. */
const getContentFile = (...segments: string[]) =>
  path.resolve(process.cwd(), "../contents", ...segments);

describe("mdx material parser", () => {
  it("parses current exercise material files that use path.ts and satisfies", async () => {
    const sets = await Effect.runPromise(
      parseExerciseMaterialFile(
        getContentFile(
          "exercises",
          "high-school",
          "snbt",
          "quantitative-knowledge",
          "_data",
          "id-material.ts"
        ),
        "id"
      )
    );

    expect(sets).toHaveLength(10);
    expect(sets[0]).toMatchObject({
      locale: "id",
      slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1",
      title: "Set 1",
    });
  });

  it("parses current subject material files that use path.ts and satisfies", async () => {
    const topics = await Effect.runPromise(
      parseSubjectMaterialFile(
        getContentFile(
          "subject",
          "high-school",
          "10",
          "mathematics",
          "_data",
          "id-material.ts"
        ),
        "id"
      )
    );

    expect(topics.length).toBeGreaterThan(0);
    expect(topics.map((topic) => topic.title).slice(0, 4)).toEqual([
      "Eksponen dan Logaritma",
      "Barisan dan Deret",
      "Vektor dan Operasinya",
      "Trigonometri",
    ]);
    expect(topics[0]).toMatchObject({
      locale: "id",
      order: 0,
      slug: "subject/high-school/10/mathematics/exponential-logarithm",
      title: "Eksponen dan Logaritma",
    });
    expect(topics[0]?.sections.slice(0, 3)).toEqual([
      {
        order: 0,
        section: "basic-concept",
        slug: "subject/high-school/10/mathematics/exponential-logarithm/basic-concept",
      },
      {
        order: 1,
        section: "properties",
        slug: "subject/high-school/10/mathematics/exponential-logarithm/properties",
      },
      {
        order: 2,
        section: "proof-properties",
        slug: "subject/high-school/10/mathematics/exponential-logarithm/proof-properties",
      },
    ]);
  });
});

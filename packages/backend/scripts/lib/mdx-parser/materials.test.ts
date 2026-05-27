import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";
import { getUnknownMessage } from "@repo/backend/scripts/lib/errors";
import {
  parseExerciseMaterialFile,
  parseSubjectMaterialFile,
} from "@repo/backend/scripts/lib/mdx-parser/materials";
import { Effect, Exit, Schema } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

class MaterialTestError extends Schema.TaggedError<MaterialTestError>()(
  "MaterialTestError",
  {
    message: Schema.String,
  }
) {}

/** Resolves a test fixture path inside the shared contents package. */
const getContentFile = (...segments: string[]) =>
  path.resolve(process.cwd(), "../contents", ...segments);

/** Runs an invalid material effect without preserving its success type. */
const runInvalidMaterial = <A, E>(effect: Effect.Effect<A, E, never>) =>
  Effect.runPromiseExit(effect);

/** Creates one temporary material file under a content-shaped directory. */
const createTempMaterialFile = Effect.fn("materialTest.createTempMaterialFile")(
  function* (relativeFilePath: string, content: string, pathContent?: string) {
    return yield* Effect.try({
      try: () => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nakafa-mdx-"));
        const filePath = path.join(directory, relativeFilePath);

        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content);

        if (pathContent !== undefined) {
          fs.writeFileSync(
            path.join(path.dirname(filePath), "path.ts"),
            pathContent
          );
        }

        return { directory, filePath };
      },
      catch: (error) =>
        new MaterialTestError({ message: getUnknownMessage(error) }),
    });
  }
);

/** Removes one temporary material fixture directory. */
const removeTempMaterialDirectory = Effect.fn(
  "materialTest.removeTempMaterialDirectory"
)(function* (directory: string) {
  yield* Effect.try({
    try: () => fs.rmSync(directory, { force: true, recursive: true }),
    catch: (error) =>
      new MaterialTestError({ message: getUnknownMessage(error) }),
  }).pipe(Effect.orDie);
});

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("node:fs/promises");
  vi.restoreAllMocks();
});

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
    expect(topics[0]).toMatchObject({
      locale: "id",
      slug: "subject/high-school/10/mathematics/exponential-logarithm",
      title: "Eksponen dan Logaritma",
    });
  });

  it("uses the exercise fallback base path when path.ts is missing", async () => {
    const sets = await Effect.runPromise(
      Effect.acquireUseRelease(
        createTempMaterialFile(
          "exercises/high-school/snbt/mathematics/_data/id-material.ts",
          `const mathematicsMaterials = [
            {
              title: "Quiz",
              href: "\${BASE_PATH}/quiz",
              items: [{ title: "Set 1", href: "\${BASE_PATH}/quiz/set-1" }],
            },
          ] as const;`
        ),
        ({ filePath }) => parseExerciseMaterialFile(filePath, "id"),
        ({ directory }) => removeTempMaterialDirectory(directory)
      )
    );

    expect(sets).toStrictEqual([
      {
        locale: "id",
        slug: "exercises/high-school/snbt/mathematics/quiz/set-1",
        category: "high-school",
        type: "snbt",
        material: "mathematics",
        exerciseType: "quiz",
        exerciseTypeTitle: "Quiz",
        setName: "set-1",
        title: "Set 1",
        description: undefined,
        year: undefined,
      },
    ]);
  });

  it("uses the fallback base path when path.ts has no BASE_PATH export", async () => {
    const sets = await Effect.runPromise(
      Effect.acquireUseRelease(
        createTempMaterialFile(
          "exercises/high-school/snbt/mathematics/_data/id-material.ts",
          `const mathematicsMaterials = [
            {
              title: "Quiz",
              href: "\${BASE_PATH}/quiz",
              items: [{ title: "Set 1", href: "\${BASE_PATH}/quiz/set-1" }],
            },
          ] as const;`,
          "export const OTHER_PATH = '/wrong';"
        ),
        ({ filePath }) => parseExerciseMaterialFile(filePath, "id"),
        ({ directory }) => removeTempMaterialDirectory(directory)
      )
    );

    expect(sets[0]?.slug).toBe(
      "exercises/high-school/snbt/mathematics/quiz/set-1"
    );
  });

  it("returns empty material results when the material const is absent", async () => {
    const sets = await Effect.runPromise(
      Effect.acquireUseRelease(
        createTempMaterialFile(
          "exercises/high-school/snbt/mathematics/_data/id-material.ts",
          "export const unrelated = [];"
        ),
        ({ filePath }) => parseExerciseMaterialFile(filePath, "id"),
        ({ directory }) => removeTempMaterialDirectory(directory)
      )
    );

    expect(sets).toStrictEqual([]);
  });

  it("parses subject topic hrefs without a slash as empty topic slugs", async () => {
    const topics = await Effect.runPromise(
      Effect.acquireUseRelease(
        createTempMaterialFile(
          "subject/high-school/10/mathematics/_data/id-material.ts",
          `const mathematicsMaterials = [
            { title: "Topic", href: "topic", items: [] },
          ];
          export default mathematicsMaterials;`
        ),
        ({ filePath }) => parseSubjectMaterialFile(filePath, "id"),
        ({ directory }) => removeTempMaterialDirectory(directory)
      )
    );

    expect(topics).toStrictEqual([
      {
        locale: "id",
        slug: "subject/high-school/10/mathematics/",
        category: "high-school",
        grade: "10",
        material: "mathematics",
        topic: "",
        title: "Topic",
        description: undefined,
        sectionCount: 0,
      },
    ]);
  });

  it.each([
    [
      () =>
        runInvalidMaterial(
          parseExerciseMaterialFile("not-a-material.ts", "id")
        ),
      "Invalid material file path",
    ],
    [
      () =>
        runInvalidMaterial(
          Effect.acquireUseRelease(
            createTempMaterialFile(
              "exercises/high-school/snbt/mathematics/_data/id-material.ts",
              "const mathematicsMaterials = [bad] as const;"
            ),
            ({ filePath }) => parseExerciseMaterialFile(filePath, "id"),
            ({ directory }) => removeTempMaterialDirectory(directory)
          )
        ),
      "Invalid material file",
    ],
    [
      () =>
        runInvalidMaterial(
          Effect.acquireUseRelease(
            createTempMaterialFile(
              "exercises/high-school/snbt/mathematics/_data/id-material.ts",
              `const mathematicsMaterials = [
              { title: "Quiz", href: "\${BASE_PATH}/quiz", items: [{}] },
            ] as const;`
            ),
            ({ filePath }) => parseExerciseMaterialFile(filePath, "id"),
            ({ directory }) => removeTempMaterialDirectory(directory)
          )
        ),
      "Invalid material file",
    ],
    [
      () =>
        runInvalidMaterial(
          Effect.acquireUseRelease(
            createTempMaterialFile(
              "exercises/high-school/snbt/mathematics/_data/id-material.ts",
              `const mathematicsMaterials = [
              {
                title: "Quiz",
                href: "\${BASE_PATH}/quiz/too/deep",
                items: [{ title: "Set 1", href: "\${BASE_PATH}/quiz/set-1" }],
              },
            ] as const;`
            ),
            ({ filePath }) => parseExerciseMaterialFile(filePath, "id"),
            ({ directory }) => removeTempMaterialDirectory(directory)
          )
        ),
      "Invalid exercise group href",
    ],
    [
      () =>
        runInvalidMaterial(
          Effect.acquireUseRelease(
            createTempMaterialFile(
              "exercises/high-school/snbt/mathematics/_data/id-material.ts",
              `const mathematicsMaterials = [
              {
                title: "Quiz",
                href: "\${BASE_PATH}//2026",
                items: [{ title: "Set 1", href: "\${BASE_PATH}/quiz/set-1" }],
              },
            ] as const;`
            ),
            ({ filePath }) => parseExerciseMaterialFile(filePath, "id"),
            ({ directory }) => removeTempMaterialDirectory(directory)
          )
        ),
      "Invalid exercise group href",
    ],
    [
      () =>
        runInvalidMaterial(
          Effect.acquireUseRelease(
            createTempMaterialFile(
              "exercises/high-school/snbt/mathematics/_data/id-material.ts",
              `const mathematicsMaterials = [
              {
                title: "Quiz",
                href: "\${BASE_PATH}/quiz",
                items: [{ title: "Set 1", href: "\${BASE_PATH}/wrong/set-1" }],
              },
            ] as const;`
            ),
            ({ filePath }) => parseExerciseMaterialFile(filePath, "id"),
            ({ directory }) => removeTempMaterialDirectory(directory)
          )
        ),
      "Invalid exercise set href",
    ],
    [
      () =>
        runInvalidMaterial(
          Effect.acquireUseRelease(
            createTempMaterialFile(
              "exercises/high-school/snbt/mathematics/_data/id-material.ts",
              `const mathematicsMaterials = [
              {
                title: "Quiz",
                href: "\${BASE_PATH}/quiz",
                items: [{ title: "Set 1", href: "\${BASE_PATH}/quiz/" }],
              },
            ] as const;`
            ),
            ({ filePath }) => parseExerciseMaterialFile(filePath, "id"),
            ({ directory }) => removeTempMaterialDirectory(directory)
          )
        ),
      "Invalid exercise set href",
    ],
    [
      () =>
        runInvalidMaterial(
          parseSubjectMaterialFile("not-a-subject-material.ts", "id")
        ),
      "Invalid subject material file path",
    ],
    [
      () =>
        runInvalidMaterial(
          parseSubjectMaterialFile(
            path.join(
              os.tmpdir(),
              "subject/high-school/10/mathematics/_data/id-material.ts"
            ),
            "id"
          )
        ),
      "ENOENT",
    ],
  ])("rejects invalid material inputs", async (run, message) => {
    const exit = await run();

    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      expect(exit.cause.toString()).toContain(message);
    }
  });

  it("reports non-Error filesystem failures from material reads", async () => {
    vi.resetModules();
    vi.doMock("node:fs/promises", () => ({
      readFile: vi
        .fn()
        .mockRejectedValueOnce("missing path")
        .mockRejectedValueOnce("missing material"),
    }));
    const { parseExerciseMaterialFile: parseWithMockedFs } = await import(
      "@repo/backend/scripts/lib/mdx-parser/materials"
    );

    const exit = await Effect.runPromiseExit(
      parseWithMockedFs(
        path.join(
          os.tmpdir(),
          "exercises/high-school/snbt/mathematics/_data/id-material.ts"
        ),
        "id"
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(exit.cause.toString()).toContain("missing material");
    }
  });
});

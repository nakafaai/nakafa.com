import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { collectAllAuthorNames, collectAuthorNamesFromFiles } from "./authors";

const globCalls = vi.hoisted((): string[] => []);
const readCalls = vi.hoisted((): string[] => []);

vi.mock("@repo/backend/scripts/sync-content/runtime/files", () => ({
  /** Records author discovery globs without touching the filesystem. */
  globFiles: (pattern: string) => {
    globCalls.push(pattern);

    return Effect.succeed([`${pattern}:one.mdx`, `${pattern}:two.mdx`]);
  },
}));

vi.mock("@repo/backend/scripts/lib/mdx-parser/content", () => ({
  /** Returns stable metadata so author collection can be tested through authors.ts. */
  readMdxFile: (file: string) => {
    readCalls.push(file);

    return Effect.succeed({
      metadata: {
        authors: [
          { name: "Nakafa Author" },
          {
            name: file.includes("question.")
              ? "Practice Author"
              : "Nakafa Author",
          },
        ],
      },
    });
  },
}));

describe("content author sync", () => {
  beforeEach(() => {
    globCalls.length = 0;
    readCalls.length = 0;
  });

  it("collects authors from current material source layouts", async () => {
    const authors = await Effect.runPromise(
      collectAllAuthorNames(
        { locale: "id", quiet: true },
        { tryoutsManaged: false }
      )
    );

    expect(globCalls).toEqual([
      "articles/**/id.mdx",
      "material/lesson/**/id.mdx",
      "question-bank/tryout/**/question.id.mdx",
      "question-bank/tryout/**/answer.id.mdx",
    ]);
    expect(globCalls).not.toContain("curriculum/**/id.mdx");
    expect(globCalls).not.toContain("assessment/**/_question/id.mdx");
    expect(authors).toEqual(["Nakafa Author", "Practice Author"]);
  });

  it("does not read tryout authors after signed ownership activates", async () => {
    const allAuthors = await Effect.runPromise(
      collectAllAuthorNames(
        { locale: "id", quiet: true },
        { tryoutsManaged: true }
      )
    );
    const changedAuthors = await Effect.runPromise(
      collectAuthorNamesFromFiles(
        [
          "packages/contents/articles/example/id.mdx",
          "packages/contents/question-bank/tryout/example/question.id.mdx",
        ],
        { tryoutsManaged: true }
      )
    );

    expect(globCalls).toEqual([
      "articles/**/id.mdx",
      "material/lesson/**/id.mdx",
    ]);
    expect(
      readCalls.some((file) => file.includes("question-bank/tryout/"))
    ).toBe(false);
    expect(allAuthors).toEqual(["Nakafa Author"]);
    expect(changedAuthors).toEqual(["Nakafa Author"]);
  });
});

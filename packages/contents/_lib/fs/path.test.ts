import {
  getFolderChildNamesCacheKey,
  getFolderChildNamesCacheParts,
  isPathInsideDirectory,
  resolveSafeContentPath,
  validateContentFolderPath,
} from "@repo/contents/_lib/fs/path";
import { InvalidPathError } from "@repo/contents/_shared/error";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("content fs path helpers", () => {
  it("round-trips child-folder cache keys with and without exclusions", () => {
    const simpleKey = getFolderChildNamesCacheKey("curriculum/high-school");
    const excludedKey = getFolderChildNamesCacheKey("curriculum/high-school", [
      "drafts",
      "tmp",
    ]);

    expect(getFolderChildNamesCacheParts(simpleKey)).toStrictEqual({
      folder: "curriculum/high-school",
    });
    expect(getFolderChildNamesCacheParts(excludedKey)).toStrictEqual({
      folder: "curriculum/high-school",
      exclude: ["drafts", "tmp"],
    });
  });

  it("detects same-directory, nested, sibling, and absolute escaped paths", () => {
    expect(isPathInsideDirectory("/content/root", "/content/root")).toBe(true);
    expect(isPathInsideDirectory("/content/root", "/content/root/a")).toBe(
      true
    );
    expect(isPathInsideDirectory("/content/root", "/content/root-a")).toBe(
      false
    );
    expect(isPathInsideDirectory("/content/root", "/secret")).toBe(false);
  });

  it("resolves safe content paths and fails traversal attempts", async () => {
    const valid = await Effect.runPromise(
      resolveSafeContentPath(
        "articles/politics/test/en.mdx",
        "/content/root",
        "Invalid path."
      )
    );
    const failure = await Effect.runPromise(
      Effect.flip(
        resolveSafeContentPath("../secret", "/content/root", "Invalid path.")
      )
    );

    expect(valid).toBe("/content/root/articles/politics/test/en.mdx");
    expect(failure).toBeInstanceOf(InvalidPathError);
  });

  it("rejects unsafe folder paths before filesystem access", async () => {
    await Effect.runPromise(
      validateContentFolderPath("curriculum/high-school")
    );

    const traversal = await Effect.runPromise(
      Effect.flip(validateContentFolderPath("../secret"))
    );
    const absolute = await Effect.runPromise(
      Effect.flip(validateContentFolderPath("/content/root"))
    );

    expect(traversal).toBeInstanceOf(InvalidPathError);
    expect(absolute).toBeInstanceOf(InvalidPathError);
  });
});

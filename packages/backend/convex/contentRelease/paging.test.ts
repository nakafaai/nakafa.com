import { validateProjectionPage } from "@repo/backend/convex/contentRelease/paging";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("contentRelease/paging", () => {
  it("preserves complete bounded native pagination options", async () => {
    const options = {
      cursor: null,
      endCursor: null,
      maximumBytesRead: 4096,
      maximumRowsRead: 4,
      numItems: 4,
    };

    await expect(
      Effect.runPromise(validateProjectionPage(options))
    ).resolves.toEqual(options);
  });

  it("adds safe read budgets when native callers omit them", async () => {
    await expect(
      Effect.runPromise(
        validateProjectionPage({
          cursor: null,
          numItems: 4,
        })
      )
    ).resolves.toEqual({
      cursor: null,
      maximumBytesRead: 4 * 1024 * 1024,
      maximumRowsRead: 32,
      numItems: 4,
    });
  });

  it.each([
    [{ cursor: null, numItems: 0 }],
    [{ cursor: null, numItems: 1.5 }],
    [{ cursor: null, numItems: 33 }],
    [{ cursor: null, maximumRowsRead: 0, numItems: 1 }],
    [{ cursor: null, maximumRowsRead: 1, numItems: 2 }],
    [{ cursor: null, maximumRowsRead: 33, numItems: 1 }],
    [{ cursor: null, maximumBytesRead: 0, numItems: 1 }],
    [{ cursor: null, maximumBytesRead: 4 * 1024 * 1024 + 1, numItems: 1 }],
  ])("rejects unsafe pagination options %#", async (options) => {
    await expect(
      Effect.runPromise(validateProjectionPage(options).pipe(Effect.flip))
    ).resolves.toMatchObject({ code: "CONTENT_RELEASE_LIMIT" });
  });
});

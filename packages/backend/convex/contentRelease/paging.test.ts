import {
  validateProjectionPage,
  validatePublicationPage,
} from "@repo/backend/convex/contentRelease/paging";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";

describe("contentRelease/paging", () => {
  it.live("preserves complete bounded native pagination options", () =>
    Effect.gen(function* () {
      const options = {
        cursor: null,
        endCursor: null,
        maximumBytesRead: 4096,
        maximumRowsRead: 4,
        numItems: 4,
      };

      expect(yield* validateProjectionPage(options)).toEqual(options);
    })
  );

  it.live("adds safe read budgets when native callers omit them", () =>
    Effect.gen(function* () {
      expect(
        yield* validateProjectionPage({
          cursor: null,
          numItems: 4,
        })
      ).toEqual({
        cursor: null,
        maximumBytesRead: 4 * 1024 * 1024,
        maximumRowsRead: 32,
        numItems: 4,
      });
    })
  );

  it.live.each([
    [{ cursor: null, numItems: 0 }],
    [{ cursor: null, numItems: 1.5 }],
    [{ cursor: null, numItems: 33 }],
    [{ cursor: null, maximumRowsRead: 0, numItems: 1 }],
    [{ cursor: null, maximumRowsRead: 1, numItems: 2 }],
    [{ cursor: null, maximumRowsRead: 33, numItems: 1 }],
    [{ cursor: null, maximumBytesRead: 0, numItems: 1 }],
    [{ cursor: null, maximumBytesRead: 4 * 1024 * 1024 + 1, numItems: 1 }],
  ])("rejects unsafe pagination options %#", ([options]) =>
    Effect.gen(function* () {
      expect(
        yield* validateProjectionPage(options).pipe(Effect.flip)
      ).toMatchObject({ code: "CONTENT_RELEASE_LIMIT" });
    })
  );

  it.live("reserves both index reads through publication lookahead", () =>
    Effect.gen(function* () {
      expect(
        yield* validatePublicationPage({
          cursor: null,
          numItems: 32,
        })
      ).toMatchObject({ maximumRowsRead: 66, numItems: 32 });
      expect(
        yield* validatePublicationPage({
          cursor: null,
          maximumRowsRead: 4,
          numItems: 1,
        })
      ).toMatchObject({ maximumRowsRead: 4, numItems: 1 });
      expect(
        yield* validatePublicationPage({
          cursor: null,
          maximumRowsRead: 65,
          numItems: 32,
        }).pipe(Effect.flip)
      ).toMatchObject({ code: "CONTENT_RELEASE_LIMIT" });
      expect(
        yield* validatePublicationPage({
          cursor: null,
          maximumRowsRead: 3,
          numItems: 1,
        }).pipe(Effect.flip)
      ).toMatchObject({ code: "CONTENT_RELEASE_LIMIT" });
    })
  );
});

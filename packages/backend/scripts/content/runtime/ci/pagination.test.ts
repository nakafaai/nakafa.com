import { describe, expect, it } from "@effect/vitest";
import {
  collectConvexTableRows,
  CONTENT_RUNTIME_TABLE_PAGE_SIZE,
} from "@repo/backend/scripts/content/runtime/ci/pagination";
import { Effect } from "effect";

const row = (value: string) => ({ value });

describe("content runtime production pagination", () => {
  it.effect("reads every page below the Convex response array limit", () =>
    Effect.gen(function* () {
      const requests: Array<{
        cursor: null | string;
        numItems: number;
      }> = [];
      const pages = [
        {
          continueCursor: "cursor-1",
          isDone: false,
          page: [row("first")],
        },
        {
          continueCursor: "cursor-2",
          isDone: true,
          page: [row("second")],
        },
      ];

      const rows = yield* collectConvexTableRows({
        limit: 5000,
        readPage: async (request) => {
          requests.push(request);
          const page = pages.shift();
          if (page === undefined) {
            throw new Error("Unexpected pagination request.");
          }
          return page;
        },
        table: "contentKeys",
      });

      expect(rows).toEqual([row("first"), row("second")]);
      expect(requests).toEqual([
        { cursor: null, numItems: CONTENT_RUNTIME_TABLE_PAGE_SIZE },
        { cursor: "cursor-1", numItems: CONTENT_RUNTIME_TABLE_PAGE_SIZE },
      ]);
      expect(CONTENT_RUNTIME_TABLE_PAGE_SIZE).toBeLessThan(8192);
    })
  );

  it.effect("returns exactly the fail-closed export capacity", () =>
    Effect.gen(function* () {
      const requests: Array<{
        cursor: null | string;
        numItems: number;
      }> = [];
      const rows = yield* collectConvexTableRows({
        limit: 2,
        readPage: async (request) => {
          requests.push(request);
          return {
            continueCursor: "done",
            isDone: true,
            page: [row("first"), row("second")],
          };
        },
        table: "contentKeys",
      });

      expect(rows).toEqual([row("first"), row("second")]);
      expect(requests).toEqual([{ cursor: null, numItems: 3 }]);
    })
  );

  it.effect("rejects snapshots above the fail-closed export capacity", () =>
    Effect.gen(function* () {
      const requests: Array<{
        cursor: null | string;
        numItems: number;
      }> = [];
      const pages = [
        {
          continueCursor: "cursor-1",
          isDone: false,
          page: [row("first"), row("second")],
        },
        {
          continueCursor: "done",
          isDone: true,
          page: [row("overflow")],
        },
      ];

      const failure = yield* collectConvexTableRows({
        limit: 2,
        readPage: async (request) => {
          requests.push(request);
          const page = pages.shift();
          if (page === undefined) {
            throw new Error("Unexpected pagination request.");
          }
          return page;
        },
        table: "contentKeys",
      }).pipe(Effect.flip);

      expect(failure).toMatchObject({
        _tag: "ContentRuntimeCiError",
        message:
          "Production read for contentKeys exceeded the bounded snapshot capacity of 2 rows.",
      });
      expect(requests).toEqual([
        { cursor: null, numItems: 3 },
        { cursor: "cursor-1", numItems: 1 },
      ]);
    })
  );

  it.effect("rejects repeated cursors instead of looping forever", () =>
    Effect.gen(function* () {
      const failure = yield* collectConvexTableRows({
        limit: 10,
        readPage: async () => ({
          continueCursor: "same-cursor",
          isDone: false,
          page: [row("value")],
        }),
        table: "contentKeys",
      }).pipe(Effect.flip);

      expect(failure).toMatchObject({
        _tag: "ContentRuntimeCiError",
        message:
          "Production read for contentKeys returned an invalid pagination cursor.",
      });
    })
  );

  it.effect("rejects non-JSON production rows", () =>
    Effect.gen(function* () {
      const failure = yield* collectConvexTableRows({
        limit: 10,
        readPage: async () => ({
          continueCursor: "done",
          isDone: true,
          page: [{ value: Number.POSITIVE_INFINITY }],
        }),
        table: "contentKeys",
      }).pipe(Effect.flip);

      expect(failure).toMatchObject({
        _tag: "ContentRuntimeCiError",
        message:
          "Production read for contentKeys returned invalid pagination data.",
      });
    })
  );

  it.effect("redacts the deploy key from query failures", () =>
    Effect.gen(function* () {
      const deployKey = "prod:project|sensitive-secret";
      const failure = yield* collectConvexTableRows({
        limit: 10,
        readPage: async () => {
          throw new Error(`Permission denied for ${deployKey}`);
        },
        sensitiveValues: [deployKey],
        table: "contentKeys",
      }).pipe(Effect.flip);

      expect(failure).toMatchObject({
        _tag: "ContentRuntimeCiError",
        message:
          "Production read for contentKeys failed: Permission denied for [redacted]",
      });
      expect(failure.message).not.toContain(deployKey);
    })
  );
});

import {
  migrationPageOptions,
  migrationPageResult,
  TRYOUT_MIGRATION_PAGE_LIMIT,
  validateMigrationPage,
} from "@repo/backend/convex/tryouts/migrations/spec";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("tryouts/migrations/spec", () => {
  it("enforces server-owned scan ceilings", () => {
    expect(
      migrationPageOptions({
        cursor: null,
        maximumBytesRead: 1,
        maximumRowsRead: 1,
        numItems: TRYOUT_MIGRATION_PAGE_LIMIT,
      })
    ).toEqual({
      cursor: null,
      maximumBytesRead: 1024 * 1024,
      maximumRowsRead: TRYOUT_MIGRATION_PAGE_LIMIT,
      numItems: TRYOUT_MIGRATION_PAGE_LIMIT,
    });
  });

  it("accepts an exact bounded page and returns only progress evidence", async () => {
    await expect(
      Effect.runPromise(
        validateMigrationPage({
          expectedProcessed: 0,
          expectedTotal: 2,
          numItems: TRYOUT_MIGRATION_PAGE_LIMIT,
          page: { isDone: true, page: ["a", "b"] },
          table: "tryoutAttempts",
        })
      )
    ).resolves.toBe(2);
    expect(
      migrationPageResult(
        { continueCursor: "next", isDone: false, page: ["a", "b"] },
        1,
        2
      )
    ).toEqual({
      changed: 1,
      continueCursor: "next",
      isDone: false,
      processed: 2,
      scanned: 2,
    });
  });

  it.each([0, TRYOUT_MIGRATION_PAGE_LIMIT + 1])(
    "rejects an unsafe page size of %i",
    async (numItems) => {
      await expect(
        Effect.runPromise(
          validateMigrationPage({
            expectedProcessed: 0,
            expectedTotal: 1,
            numItems,
            page: { isDone: true, page: ["a"] },
            table: "tryoutAttempts",
          }).pipe(Effect.flip)
        )
      ).resolves.toMatchObject({
        _tag: "TryoutMigrationError",
        code: "TRYOUT_MIGRATION_INVALID",
        message: `Try-out migration pages must contain 1 to ${TRYOUT_MIGRATION_PAGE_LIMIT} rows.`,
      });
    }
  );

  it("rejects terminal progress that differs from the audited count", async () => {
    await expect(
      Effect.runPromise(
        validateMigrationPage({
          expectedProcessed: 0,
          expectedTotal: 1,
          numItems: TRYOUT_MIGRATION_PAGE_LIMIT,
          page: { isDone: true, page: ["a", "b"] },
          table: "tryoutAttempts",
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "TryoutMigrationError",
      code: "TRYOUT_MIGRATION_INVALID",
      message: "tryoutAttempts expected 1 rows but reached 2.",
    });
  });

  it("accepts an exact full page followed by terminal cursor proof", async () => {
    await expect(
      Effect.runPromise(
        validateMigrationPage({
          expectedProcessed: 1,
          expectedTotal: 2,
          numItems: 1,
          page: { isDone: false, page: ["b"] },
          table: "tryoutAttempts",
        })
      )
    ).resolves.toBe(2);
    await expect(
      Effect.runPromise(
        validateMigrationPage({
          expectedProcessed: 2,
          expectedTotal: 2,
          numItems: 1,
          page: { isDone: true, page: [] },
          table: "tryoutAttempts",
        })
      )
    ).resolves.toBe(2);
  });

  it("rejects a cursor page that exceeds the audited count", async () => {
    await expect(
      Effect.runPromise(
        validateMigrationPage({
          expectedProcessed: 2,
          expectedTotal: 2,
          numItems: 1,
          page: { isDone: false, page: ["c"] },
          table: "tryoutAttempts",
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "TryoutMigrationError",
      code: "TRYOUT_MIGRATION_INVALID",
      message: "tryoutAttempts expected 2 rows but reached 3.",
    });
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid processed count %s",
    async (expectedProcessed) => {
      await expect(
        Effect.runPromise(
          validateMigrationPage({
            expectedProcessed,
            expectedTotal: 2,
            numItems: 1,
            page: { isDone: false, page: ["a"] },
            table: "tryoutAttempts",
          }).pipe(Effect.flip)
        )
      ).resolves.toMatchObject({
        _tag: "TryoutMigrationError",
        code: "TRYOUT_MIGRATION_INVALID",
        message: "Try-out migration counts must be safe integers.",
      });
    }
  );
});

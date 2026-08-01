import {
  migrationPageOptions,
  migrationPageResult,
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
        numItems: 50,
      })
    ).toEqual({
      cursor: null,
      maximumBytesRead: 4 * 1024 * 1024,
      maximumRowsRead: 64,
      numItems: 50,
    });
  });

  it("accepts an exact bounded page and returns only progress evidence", async () => {
    await expect(
      Effect.runPromise(
        validateMigrationPage({
          expectedProcessed: 0,
          expectedTotal: 2,
          numItems: 50,
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

  it.each([0, 51])("rejects an unsafe page size of %i", async (numItems) => {
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
      message: "Try-out migration pages must contain 1 to 50 rows.",
    });
  });

  it("rejects terminal progress that differs from the audited count", async () => {
    await expect(
      Effect.runPromise(
        validateMigrationPage({
          expectedProcessed: 0,
          expectedTotal: 1,
          numItems: 50,
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

  it("rejects an incomplete page that consumes the audited count", async () => {
    await expect(
      Effect.runPromise(
        validateMigrationPage({
          expectedProcessed: 1,
          expectedTotal: 2,
          numItems: 1,
          page: { isDone: false, page: ["b"] },
          table: "tryoutAttempts",
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "TryoutMigrationError",
      code: "TRYOUT_MIGRATION_INVALID",
      message: "tryoutAttempts expected 2 rows but reached 2.",
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

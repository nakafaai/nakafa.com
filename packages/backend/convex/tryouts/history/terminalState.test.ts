import {
  terminalFrozenPageBudget,
  verifyTerminalFrozenPageBudget,
} from "@repo/backend/convex/tryouts/history/terminalState";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("tryouts/history/terminalState", () => {
  it("grounds the frozen-page transaction ceilings", () => {
    expect(terminalFrozenPageBudget).toEqual({
      bytesRead: 2_097_152,
      databaseQueries: 1,
      documentsRead: 8,
    });
  });

  it("accepts the rehearsal page delta from an arbitrary baseline", async () => {
    const before = pageMetrics({
      bytesRead: 10_000,
      databaseQueries: 28,
      documentsRead: 4,
    });
    await expect(
      Effect.runPromise(
        verifyTerminalFrozenPageBudget(
          before,
          pageMetrics({
            bytesRead: 10_000 + terminalFrozenPageBudget.bytesRead,
            databaseQueries: 29,
            documentsRead: 4 + terminalFrozenPageBudget.documentsRead,
          })
        )
      )
    ).resolves.toBeUndefined();
  });

  it.each([
    {
      name: "byte ceiling",
      before: pageMetrics(),
      after: pageMetrics({
        bytesRead: terminalFrozenPageBudget.bytesRead + 1,
      }),
    },
    {
      name: "query ceiling",
      before: pageMetrics(),
      after: pageMetrics({
        databaseQueries: terminalFrozenPageBudget.databaseQueries + 1,
      }),
    },
    {
      name: "document ceiling",
      before: pageMetrics(),
      after: pageMetrics({
        documentsRead: terminalFrozenPageBudget.documentsRead + 1,
      }),
    },
    {
      name: "negative byte delta",
      before: pageMetrics({ bytesRead: 1 }),
      after: pageMetrics(),
    },
    {
      name: "negative query delta",
      before: pageMetrics({ databaseQueries: 1 }),
      after: pageMetrics(),
    },
    {
      name: "negative document delta",
      before: pageMetrics({ documentsRead: 1 }),
      after: pageMetrics(),
    },
  ])("fails closed beyond the $name", async ({ after, before }) => {
    await expect(
      Effect.runPromise(
        verifyTerminalFrozenPageBudget(before, after).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "TryoutHistoryError",
      code: "TRYOUT_HISTORY_READ_FAILED",
    });
  });
});

function pageMetrics(
  override: Partial<{
    readonly bytesRead: number;
    readonly databaseQueries: number;
    readonly documentsRead: number;
  }> = {}
) {
  return {
    bytesRead: metric(override.bytesRead ?? 0),
    databaseQueries: metric(override.databaseQueries ?? 0),
    documentsRead: metric(override.documentsRead ?? 0),
  };
}

function metric(used: number) {
  return { remaining: 0, used };
}

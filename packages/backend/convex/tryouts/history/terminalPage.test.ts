import {
  terminalHistoryPageBudget,
  verifyTerminalPageBudget,
} from "@repo/backend/convex/tryouts/history/terminalPage";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("tryouts/history/terminalPage", () => {
  it("grounds the full-page transaction ceilings", () => {
    expect(terminalHistoryPageBudget).toEqual({
      bytesRead: 9_961_472,
      databaseQueries: 17,
      documentsRead: 24,
    });
  });

  it("accepts the rehearsal page delta from an arbitrary baseline", async () => {
    const before = pageMetrics({
      bytesRead: 2000,
      databaseQueries: 12,
      documentsRead: 5,
    });
    await expect(
      Effect.runPromise(
        verifyTerminalPageBudget(
          before,
          pageMetrics({
            bytesRead: 2000 + terminalHistoryPageBudget.bytesRead,
            databaseQueries: 29,
            documentsRead: 5 + terminalHistoryPageBudget.documentsRead,
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
        bytesRead: terminalHistoryPageBudget.bytesRead + 1,
      }),
    },
    {
      name: "query ceiling",
      before: pageMetrics(),
      after: pageMetrics({
        databaseQueries: terminalHistoryPageBudget.databaseQueries + 1,
      }),
    },
    {
      name: "document ceiling",
      before: pageMetrics(),
      after: pageMetrics({
        documentsRead: terminalHistoryPageBudget.documentsRead + 1,
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
        verifyTerminalPageBudget(before, after).pipe(Effect.flip)
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

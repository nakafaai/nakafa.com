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
      databaseQueries: 33,
      documentsRead: 24,
    });
  });

  it("accepts both the rehearsal and exact worst-case query counts", async () => {
    await expect(
      Effect.runPromise(
        verifyTerminalPageBudget(pageMetrics({ databaseQueries: 29 }))
      )
    ).resolves.toBeUndefined();
    await expect(
      Effect.runPromise(
        verifyTerminalPageBudget(pageMetrics({ databaseQueries: 33 }))
      )
    ).resolves.toBeUndefined();
  });

  it.each([
    {
      name: "byte ceiling",
      metrics: pageMetrics({
        bytesRead: terminalHistoryPageBudget.bytesRead + 1,
      }),
    },
    {
      name: "query ceiling",
      metrics: pageMetrics({
        databaseQueries: terminalHistoryPageBudget.databaseQueries + 1,
      }),
    },
    {
      name: "document ceiling",
      metrics: pageMetrics({
        documentsRead: terminalHistoryPageBudget.documentsRead + 1,
      }),
    },
  ])("fails closed beyond the $name", async ({ metrics }) => {
    await expect(
      Effect.runPromise(verifyTerminalPageBudget(metrics).pipe(Effect.flip))
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
  }>
) {
  return {
    bytesRead: metric(
      override.bytesRead ?? terminalHistoryPageBudget.bytesRead
    ),
    databaseQueries: metric(
      override.databaseQueries ?? terminalHistoryPageBudget.databaseQueries
    ),
    documentsRead: metric(
      override.documentsRead ?? terminalHistoryPageBudget.documentsRead
    ),
  };
}

function metric(used: number) {
  return { remaining: 0, used };
}

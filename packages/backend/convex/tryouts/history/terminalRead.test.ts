import {
  historyFail,
  type RetainedTryoutHistoryPlan,
} from "@repo/backend/convex/tryouts/history/spec";
import type { AuthenticatedTerminalBundle } from "@repo/backend/convex/tryouts/history/terminalBundle";
import {
  readAndAuthenticateTerminalHistory,
  readTerminalFrozenRows,
} from "@repo/backend/convex/tryouts/history/terminalRead";
import type { TerminalHistorySourceService } from "@repo/backend/convex/tryouts/history/terminalSource";
import { TEST_PROOF_RENDERER } from "@repo/backend/test/content-proof";
import { provideHistoryTestTrust } from "@repo/backend/test/tryout-history";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const emptyPlan = {
  artifactCount: 0,
  attemptCount: 0,
  catalogRowCount: 0,
  firstCatalogIndex: 0,
  firstPlacementIndex: 0,
  format: "tryout-v1",
  frozenPlacementCount: 0,
  placementRowCount: 0,
  progressCount: 0,
  releases: [],
  snapshotId: "sha256:test",
} satisfies RetainedTryoutHistoryPlan;
const testBundle = {
  releaseId: "test-release",
  renderer: TEST_PROOF_RENDERER,
  rendererContractVersion: "1.0.0",
} satisfies AuthenticatedTerminalBundle;

describe("tryouts/history/terminalRead", () => {
  it("rejects a history cursor that does not advance", async () => {
    const source = makeSource({
      historyPage: (cursor) =>
        Effect.succeed({ cursor: cursor ?? "same", done: false, rows: [] }),
    });

    await expectReadFailure(
      provideHistoryTestTrust(
        readAndAuthenticateTerminalHistory(source, [testBundle], {
          ...emptyPlan,
          catalogRowCount: 16,
        })
      )
    );
  });

  it("rejects history paging beyond its calculated hard bound", async () => {
    let page = 0;
    const source = makeSource({
      historyPage: () => {
        page += 1;
        return Effect.succeed({
          cursor: `next-${page}`,
          done: false,
          rows: [],
        });
      },
    });

    await expectReadFailure(
      provideHistoryTestTrust(
        readAndAuthenticateTerminalHistory(source, [testBundle], emptyPlan)
      )
    );
  });

  it("rejects a frozen cursor that does not advance", async () => {
    const source = makeSource({
      frozenPage: (cursor) =>
        Effect.succeed({ cursor: cursor ?? "same", done: false, rows: [] }),
    });

    await expectReadFailure(
      readTerminalFrozenRows(source, {
        ...emptyPlan,
        frozenPlacementCount: 16,
      })
    );
  });

  it("rejects frozen paging beyond its calculated hard bound", async () => {
    let page = 0;
    const source = makeSource({
      frozenPage: () => {
        page += 1;
        return Effect.succeed({
          cursor: `next-${page}`,
          done: false,
          rows: [],
        });
      },
    });

    await expectReadFailure(readTerminalFrozenRows(source, emptyPlan));
  });
});

function makeSource(
  override: Partial<TerminalHistorySourceService>
): TerminalHistorySourceService {
  const unavailable = () =>
    historyFail("TRYOUT_HISTORY_READ_FAILED", "Unexpected test read.");
  return {
    frozenPage: unavailable,
    historyPage: unavailable,
    identities: unavailable,
    signedState: unavailable,
    ...override,
  };
}

async function expectReadFailure<A>(
  program: Effect.Effect<A, { readonly code: string }>
) {
  await expect(
    Effect.runPromise(
      program.pipe(
        Effect.flip,
        Effect.map((error) => error.code)
      )
    )
  ).resolves.toBe("TRYOUT_HISTORY_READ_FAILED");
}

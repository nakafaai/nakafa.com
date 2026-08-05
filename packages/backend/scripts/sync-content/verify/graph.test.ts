import type { ConvexConfig } from "@repo/backend/scripts/sync-content/contract/types";
import { verifyGraphIdentity } from "@repo/backend/scripts/sync-content/verify/graph";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getGraphIdentityIntegrityMock = vi.hoisted(() => vi.fn());

vi.mock("@repo/backend/scripts/sync-content/convex/inspection", () => ({
  getGraphIdentityIntegrity: getGraphIdentityIntegrityMock,
}));

vi.mock("@repo/backend/scripts/sync-content/cli/logging", () => ({
  log: vi.fn(),
  logError: vi.fn(),
  logSuccess: vi.fn(),
}));

const config: ConvexConfig = {
  accessToken: "test-token",
  url: "https://example.convex.cloud",
};

beforeEach(() => {
  getGraphIdentityIntegrityMock.mockReset();
});

describe("sync-content graph verification", () => {
  it("accepts clean persisted graph identity", async () => {
    getGraphIdentityIntegrityMock.mockReturnValue(
      Effect.succeed(persistedIntegrity(0))
    );

    await expect(Effect.runPromise(verifyGraphIdentity(config))).resolves.toBe(
      true
    );
  });

  it("rejects persisted graph identity violations", async () => {
    getGraphIdentityIntegrityMock.mockReturnValue(
      Effect.succeed(persistedIntegrity(1))
    );

    await expect(Effect.runPromise(verifyGraphIdentity(config))).resolves.toBe(
      false
    );
  });
});

function persistedIntegrity(issueCount: number) {
  const issue = issueCount > 0 ? { route: "content/stale" } : null;

  return {
    checkedRefs: 1,
    checkedRefInputs: 1,
    firstInvalidRefInput: issue,
    firstMissingGraph: issue,
    firstMismatchedContentId: issue,
    firstRouteShapedContentId: issue,
    invalidRefInputs: issueCount,
    missingGraphRows: issueCount,
    mismatchedContentIds: issueCount,
    routeShapedContentIds: issueCount,
    scannedRows: 1,
  };
}

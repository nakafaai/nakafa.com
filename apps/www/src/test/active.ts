import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { Hex } from "effect/encoding";

/** The snapshot ids that one release names, unless a test keeps a family's snapshot across releases. */
type TestSnapshots = Partial<
  Record<"assessment" | "program" | "quran", string | null>
>;

/** A snapshot id of one family under one release, distinct for every release and family. */
function testSnapshotId(releaseId: string, family: string) {
  const hex = Hex.encode(`${family}:${releaseId}`);
  return Sha256HashSchema.make(`sha256:${hex.padEnd(64, "0").slice(0, 64)}`);
}

/** The active identity that Convex and the stored pointer name for one release. */
function makeTestActiveIdentity(releaseId: string, snapshots: TestSnapshots) {
  const snapshotOf = (family: "assessment" | "program" | "quran") => {
    const kept = snapshots[family];
    if (kept === undefined) {
      return testSnapshotId(releaseId, family);
    }
    return kept === null ? null : Sha256HashSchema.make(kept);
  };
  return {
    manifestHash: Sha256HashSchema.make(`sha256:${"a".repeat(64)}`),
    releaseId: ReleaseIdSchema.make(releaseId),
    sequence: 1,
    snapshots: {
      assessment: snapshotOf("assessment"),
      program: snapshotOf("program"),
      quran: snapshotOf("quran"),
    },
  };
}

/** The three release reads that a test replaces, so each can be inspected. */
const testActive = {
  expire: vi.fn(),
  load: vi.fn(),
  read: vi.fn(),
};

/** The module that a test hands to `vi.mock` in place of the release reads. */
export const testActiveModule = {
  expireActiveContentIdentity: testActive.expire,
  loadActiveContentIdentity: testActive.load,
  readActiveContentIdentity: testActive.read,
};

/**
 * Makes the stored pointer and Convex name one release, and forgets every call.
 * Each family's snapshot is distinct for the release unless `snapshots` keeps
 * one, as a release that does not change that family does.
 */
export function activateTestRelease(
  releaseId: string,
  snapshots: TestSnapshots = {}
) {
  const identity = Effect.succeed(makeTestActiveIdentity(releaseId, snapshots));
  testActive.expire.mockReset().mockReturnValue(Effect.void);
  testActive.load.mockReset().mockReturnValue(identity);
  testActive.read.mockReset().mockReturnValue(identity);
}

/**
 * Lands a release in Convex while the stored pointer still names the previous
 * one, as in production, where nothing updates the pointer for the activation
 * but its expiry. The pointer follows Convex once a read drops it.
 */
export function advanceTestRelease(
  releaseId: string,
  snapshots: TestSnapshots = {}
) {
  const identity = Effect.succeed(makeTestActiveIdentity(releaseId, snapshots));
  testActive.load.mockReturnValue(identity);
  testActive.expire.mockImplementation(() =>
    Effect.sync(() => {
      testActive.read.mockReturnValue(identity);
    })
  );
}

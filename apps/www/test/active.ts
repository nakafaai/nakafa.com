import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";

/** The active identity that Convex and the stored pointer name for one release. */
function makeTestActiveIdentity(releaseId: string) {
  return {
    manifestHash: Sha256HashSchema.make(`sha256:${"a".repeat(64)}`),
    releaseId: ReleaseIdSchema.make(releaseId),
    sequence: 1,
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

/** Makes the stored pointer and Convex name one release, and forgets every call. */
export function activateTestRelease(releaseId: string) {
  const identity = Effect.succeed(makeTestActiveIdentity(releaseId));
  testActive.expire.mockReset().mockReturnValue(Effect.void);
  testActive.load.mockReset().mockReturnValue(identity);
  testActive.read.mockReset().mockReturnValue(identity);
}

/**
 * Lands a release in Convex while the stored pointer still names the previous
 * one, as in production, where nothing updates the pointer for the activation
 * but its expiry. The pointer follows Convex once a read drops it.
 */
export function advanceTestRelease(releaseId: string) {
  const identity = Effect.succeed(makeTestActiveIdentity(releaseId));
  testActive.load.mockReturnValue(identity);
  testActive.expire.mockImplementation(() =>
    Effect.sync(() => {
      testActive.read.mockReturnValue(identity);
    })
  );
}

import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import {
  testEmptyManifest,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import type { TestIdentity } from "@repo/backend/test/content/state";

export const TEST_RUNTIME_NOW = Date.UTC(2026, 6, 23, 12);
export const TEST_RUNTIME_PATH = "subjects/test/runtime";

const runtimeReleaseId = ReleaseIdSchema.make("release-runtime");
const runtimeManifest = testEmptyManifest(runtimeReleaseId);

export const TEST_RUNTIME_ENVELOPE = testSignedRelease({
  ...runtimeManifest,
  scope: {
    content: [],
    families: runtimeManifest.scope.families,
    snapshots: runtimeManifest.scope.snapshots,
  },
});

export const TEST_RUNTIME_RELEASE = {
  manifestHash: TEST_RUNTIME_ENVELOPE.manifestHash,
  releaseId: runtimeReleaseId,
  sequence: 3,
} satisfies TestIdentity;

import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import {
  testEmptyManifest,
  testSignedRelease,
} from "@repo/backend/test/content-proof";
import type { TestIdentity } from "@repo/backend/test/content-state";

export const TEST_RUNTIME_NOW = Date.UTC(2026, 6, 23, 12);
export const TEST_RUNTIME_PATH = "test/runtime";

const runtimeReleaseId = ReleaseIdSchema.make("release-runtime");

export const TEST_RUNTIME_ENVELOPE = testSignedRelease(
  testEmptyManifest(runtimeReleaseId)
);

export const TEST_RUNTIME_RELEASE = {
  manifestHash: TEST_RUNTIME_ENVELOPE.manifestHash,
  releaseId: runtimeReleaseId,
  sequence: 3,
} satisfies TestIdentity;

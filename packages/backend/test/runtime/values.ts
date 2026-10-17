import { it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { testSignedEmptyRelease } from "@repo/backend/test/content/proof";
import type { TestIdentity } from "@repo/backend/test/content/state";
import { Effect } from "effect";

export const TEST_RUNTIME_PATH = "subjects/test/runtime";

const runtimeReleaseId = ReleaseIdSchema.make("release-runtime");

/** The runtime release id and sequence, which are plain data. */
export const TEST_RUNTIME_RELEASE = {
  releaseId: runtimeReleaseId,
  sequence: 3,
} satisfies Omit<TestIdentity, "manifestHash">;

/** Signs the empty runtime manifest with the isolated test key. */
export const testRuntimeEnvelope = Effect.fn("test.runtime.envelope")(
  function* () {
    return yield* testSignedEmptyRelease(runtimeReleaseId);
  }
);

/** Identifies the runtime release by its signed manifest hash, id and sequence. */
export const testRuntimeRelease = Effect.fn("test.runtime.release")(
  function* () {
    const envelope = yield* testRuntimeEnvelope();
    return {
      ...TEST_RUNTIME_RELEASE,
      manifestHash: envelope.manifestHash,
    } satisfies TestIdentity;
  }
);

/** Runs one promise-based test body with the signed runtime release, signed inside its Effect. */
export function itWithRuntimeRelease(
  name: string,
  body: (runtime: TestIdentity) => void | Promise<void>
) {
  return it.effect(name, () =>
    Effect.gen(function* () {
      const runtime = yield* testRuntimeRelease();
      yield* Effect.promise(async () => body(runtime));
    })
  );
}

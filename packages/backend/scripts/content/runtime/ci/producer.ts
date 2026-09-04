import { randomUUID } from "node:crypto";
import { CONTENT_RUNTIME_ARCHIVE_EXPORT_TIMEOUT_MS } from "@repo/backend/content/archive";
import type { ProducerConfig } from "@repo/backend/scripts/content/runtime/ci/access";
import { publishRuntimeArchive } from "@repo/backend/scripts/content/runtime/ci/artifact";
import { contentRuntimeCiError } from "@repo/backend/scripts/content/runtime/ci/error";
import type { exportSignedRuntime } from "@repo/backend/scripts/content/runtime/ci/export";
import {
  claimRuntimeArchive,
  releaseRuntimeArchiveClaim,
} from "@repo/backend/scripts/content/runtime/ci/remote";
import { Console, Effect } from "effect";

/** Produces and stores one archive only when its exact identity is absent. */
export const produceRuntimeArchive = Effect.fn(
  "contentRuntimeArtifact.produce"
)(function* (
  config: ProducerConfig,
  fetcher: typeof fetch,
  exporter: typeof exportSignedRuntime
) {
  const claimId = randomUUID();
  const claim = yield* claimRuntimeArchive(config, claimId, fetcher);
  if (claim.kind === "existing") {
    yield* Console.log("Immutable signed runtime archive already exists.");
    return { kind: "unchanged", metadata: claim.metadata } as const;
  }
  if (claim.kind === "busy") {
    return yield* contentRuntimeCiError(
      "Immutable signed runtime archive is being produced by another run."
    );
  }
  return yield* Effect.acquireUseRelease(
    Effect.succeed(claimId),
    (ownedClaimId) =>
      Effect.gen(function* () {
        yield* exporter(config).pipe(
          Effect.timeoutOrElse({
            duration: CONTENT_RUNTIME_ARCHIVE_EXPORT_TIMEOUT_MS,
            orElse: () =>
              Effect.fail(
                contentRuntimeCiError(
                  "Signed runtime export exceeded its producer lease safety window."
                )
              ),
          })
        );
        const renewed = yield* claimRuntimeArchive(
          config,
          ownedClaimId,
          fetcher
        );
        if (renewed.kind === "existing") {
          yield* Console.log(
            "Immutable signed runtime archive was stored by another run."
          );
          return { kind: "unchanged", metadata: renewed.metadata } as const;
        }
        if (renewed.kind === "busy") {
          return yield* contentRuntimeCiError(
            "Immutable signed runtime archive lease changed during export."
          );
        }
        return yield* publishRuntimeArchive(config, ownedClaimId, fetcher);
      }),
    (ownedClaimId) =>
      releaseRuntimeArchiveClaim(config, ownedClaimId, fetcher).pipe(
        Effect.ignore
      )
  );
});

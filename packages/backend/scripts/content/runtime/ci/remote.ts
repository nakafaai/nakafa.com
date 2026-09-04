import { createHash } from "node:crypto";
import {
  ContentRuntimeArchiveClaimResultSchema,
  ContentRuntimeArchiveDownloadSchema,
  ContentRuntimeArchiveErrorSchema,
  ContentRuntimeArchiveReleaseResultSchema,
} from "@repo/backend/content/archive";
import {
  CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH,
  CONTENT_RUNTIME_ARCHIVE_DOWNLOAD_PATH,
  CONTENT_RUNTIME_ARCHIVE_RELEASE_PATH,
} from "@repo/backend/content/endpoint";
import type {
  RuntimeArchiveReadConfig,
  RuntimeArchiveWriteConfig,
} from "@repo/backend/scripts/content/runtime/ci/access";
import { contentRuntimeCiError } from "@repo/backend/scripts/content/runtime/ci/error";
import {
  archiveHttpError,
  decodeControlResponse,
  fetchArchive,
  postArchiveControl,
} from "@repo/backend/scripts/content/runtime/ci/transport";
import { Effect, Option, Result } from "effect";

function identity(config: RuntimeArchiveReadConfig) {
  return {
    contentStateHash: config.contentStateHash,
    runtimeSchemaFingerprint: config.runtimeSchemaFingerprint,
  };
}

function readCredential(config: RuntimeArchiveReadConfig) {
  return {
    header: "x-nakafa-content-token",
    token: config.runtimeToken,
  };
}

function writeCredential(config: RuntimeArchiveWriteConfig) {
  return {
    header: "x-nakafa-archive-token",
    token: config.archiveToken,
  };
}

/** Acquires one producer lease for an archive identity that is still absent. */
export const claimRuntimeArchive = Effect.fn("contentRuntimeRemote.claim")(
  function* (
    config: RuntimeArchiveWriteConfig,
    claimId: string,
    fetcher: typeof fetch
  ) {
    const operation = "Runtime archive producer claim";
    const response = yield* postArchiveControl(
      fetcher,
      config.siteUrl,
      CONTENT_RUNTIME_ARCHIVE_CLAIM_PATH,
      { ...identity(config), claimId },
      writeCredential(config),
      operation
    );
    if (!response.ok) {
      return yield* archiveHttpError(operation, response.status);
    }
    return yield* decodeControlResponse(
      response,
      ContentRuntimeArchiveClaimResultSchema,
      operation
    );
  }
);

/** Idempotently releases one producer lease after its scoped work exits. */
export const releaseRuntimeArchiveClaim = Effect.fn(
  "contentRuntimeRemote.release"
)(function* (
  config: RuntimeArchiveWriteConfig,
  claimId: string,
  fetcher: typeof fetch
) {
  const operation = "Runtime archive producer release";
  const response = yield* postArchiveControl(
    fetcher,
    config.siteUrl,
    CONTENT_RUNTIME_ARCHIVE_RELEASE_PATH,
    { ...identity(config), claimId },
    writeCredential(config),
    operation
  );
  if (!response.ok) {
    return yield* archiveHttpError(operation, response.status);
  }
  return yield* decodeControlResponse(
    response,
    ContentRuntimeArchiveReleaseResultSchema,
    operation
  );
});

/** Reads exactly the authenticated metadata length without unbounded buffering. */
const readExactArchiveBody = Effect.fn("contentRuntimeRemote.readBody")(
  function* (response: Response, expectedBytes: number) {
    const declaredLength = response.headers.get("content-length");
    if (
      declaredLength !== null &&
      Number.parseInt(declaredLength, 10) !== expectedBytes
    ) {
      return yield* contentRuntimeCiError(
        "Runtime archive download length did not match authenticated metadata."
      );
    }
    if (!response.body) {
      return yield* contentRuntimeCiError(
        "Runtime archive download returned no body."
      );
    }
    const body = response.body;

    return yield* Effect.tryPromise({
      catch: () =>
        contentRuntimeCiError(
          "Runtime archive download body did not match authenticated metadata."
        ),
      try: async () => {
        const bytes = new Uint8Array(expectedBytes);
        const reader = body.getReader();
        let offset = 0;
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) {
            break;
          }
          if (offset + chunk.value.byteLength > expectedBytes) {
            await reader.cancel();
            throw new Error("Archive body exceeded its authenticated length.");
          }
          bytes.set(chunk.value, offset);
          offset += chunk.value.byteLength;
        }
        if (offset !== expectedBytes) {
          throw new Error(
            "Archive body ended before its authenticated length."
          );
        }
        return bytes;
      },
    });
  }
);

/** Returns one authenticated capability with its downloaded and verified bytes. */
export const fetchRuntimeArchive = Effect.fn("contentRuntimeRemote.download")(
  function* (config: RuntimeArchiveReadConfig, fetcher: typeof fetch) {
    const operation = "Runtime archive download capability";
    const capabilityResponse = yield* postArchiveControl(
      fetcher,
      config.siteUrl,
      CONTENT_RUNTIME_ARCHIVE_DOWNLOAD_PATH,
      identity(config),
      readCredential(config),
      operation
    );
    if (!capabilityResponse.ok) {
      const typedFailure = yield* decodeControlResponse(
        capabilityResponse,
        ContentRuntimeArchiveErrorSchema,
        operation
      ).pipe(Effect.result);
      if (
        capabilityResponse.status === 404 &&
        Result.isSuccess(typedFailure) &&
        typedFailure.success.code === "CONTENT_RUNTIME_ARCHIVE_NOT_FOUND"
      ) {
        return Option.none();
      }
      return yield* archiveHttpError(operation, capabilityResponse.status);
    }
    const capability = yield* decodeControlResponse(
      capabilityResponse,
      ContentRuntimeArchiveDownloadSchema,
      operation
    );
    const response = yield* fetchArchive(
      fetcher,
      "Runtime archive download",
      capability.downloadUrl,
      { method: "GET", redirect: "follow" }
    );
    if (!response.ok) {
      return yield* archiveHttpError(
        "Runtime archive download",
        response.status
      );
    }
    const bytes = yield* readExactArchiveBody(response, capability.byteLength);
    if (
      createHash("sha256").update(bytes).digest("hex") !==
      capability.archiveSha256
    ) {
      return yield* contentRuntimeCiError(
        "Downloaded signed runtime archive failed its integrity check."
      );
    }
    const metadata = {
      archiveSha256: capability.archiveSha256,
      byteLength: capability.byteLength,
      contentStateHash: capability.contentStateHash,
      createdAt: capability.createdAt,
      runtimeSchemaFingerprint: capability.runtimeSchemaFingerprint,
    };
    return Option.some({ bytes, metadata });
  }
);

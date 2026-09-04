import { createHash } from "node:crypto";
import {
  CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE,
  ContentRuntimeArchiveAbortResultSchema,
  ContentRuntimeArchiveFinalizeResultSchema,
  ContentRuntimeArchiveStorageResultSchema,
  ContentRuntimeArchiveUploadSchema,
  MAX_CONTENT_RUNTIME_ARCHIVE_BYTES,
} from "@repo/backend/content/archive";
import {
  CONTENT_RUNTIME_ARCHIVE_ABORT_PATH,
  CONTENT_RUNTIME_ARCHIVE_FINALIZE_PATH,
  CONTENT_RUNTIME_ARCHIVE_UPLOAD_PATH,
} from "@repo/backend/content/endpoint";
import type { RuntimeArchiveWriteConfig } from "@repo/backend/scripts/content/runtime/ci/access";
import { contentRuntimeCiError } from "@repo/backend/scripts/content/runtime/ci/error";
import {
  archiveHttpError,
  decodeControlResponse,
  fetchArchive,
  postArchiveControl,
} from "@repo/backend/scripts/content/runtime/ci/transport";
import { Effect, Result } from "effect";

const MAX_FINALIZE_ATTEMPTS = 3;

function identity(config: RuntimeArchiveWriteConfig) {
  return {
    contentStateHash: config.contentStateHash,
    runtimeSchemaFingerprint: config.runtimeSchemaFingerprint,
  };
}

function credential(config: RuntimeArchiveWriteConfig) {
  return {
    header: "x-nakafa-archive-token",
    token: config.archiveToken,
  };
}

/** Retries only the same uploaded storage identity across transient failures. */
const finalizeUpload = Effect.fn("contentRuntimePublish.finalize")(function* (
  config: RuntimeArchiveWriteConfig,
  body: {
    readonly archiveSha256: string;
    readonly byteLength: number;
    readonly claimId: string;
    readonly contentStateHash: string;
    readonly runtimeSchemaFingerprint: string;
    readonly storageId: string;
  },
  fetcher: typeof fetch
) {
  const operation = "Runtime archive finalization";
  for (let attempt = 1; ; attempt += 1) {
    const outcome = yield* postArchiveControl(
      fetcher,
      config.siteUrl,
      CONTENT_RUNTIME_ARCHIVE_FINALIZE_PATH,
      body,
      credential(config),
      operation
    ).pipe(Effect.result);
    if (Result.isFailure(outcome)) {
      if (attempt === MAX_FINALIZE_ATTEMPTS) {
        return yield* outcome.failure;
      }
      continue;
    }
    if (outcome.success.ok) {
      return yield* decodeControlResponse(
        outcome.success,
        ContentRuntimeArchiveFinalizeResultSchema,
        operation
      );
    }
    const failure = archiveHttpError(operation, outcome.success.status);
    if (outcome.success.status < 500) {
      return yield* failure;
    }
    if (attempt === MAX_FINALIZE_ATTEMPTS) {
      return yield* failure;
    }
  }
});

/** Requests cleanup while the server defers storage with unproven ownership. */
const abortUpload = Effect.fn("contentRuntimePublish.abort")(function* (
  config: RuntimeArchiveWriteConfig,
  claimId: string,
  storageId: string,
  fetcher: typeof fetch
) {
  const operation = "Runtime archive upload cleanup";
  const response = yield* postArchiveControl(
    fetcher,
    config.siteUrl,
    CONTENT_RUNTIME_ARCHIVE_ABORT_PATH,
    { ...identity(config), claimId, storageId },
    credential(config),
    operation
  );
  if (!response.ok) {
    return yield* archiveHttpError(operation, response.status);
  }
  return yield* decodeControlResponse(
    response,
    ContentRuntimeArchiveAbortResultSchema,
    operation
  );
});

/** Uploads bytes and binds them exactly once to their runtime identity. */
export const storeRuntimeArchive = Effect.fn("contentRuntimePublish.store")(
  function* (
    config: RuntimeArchiveWriteConfig,
    claimId: string,
    bytes: Uint8Array,
    fetcher: typeof fetch
  ) {
    if (bytes.byteLength === 0) {
      return yield* contentRuntimeCiError(
        "Encrypted signed runtime archive must not be empty."
      );
    }
    if (bytes.byteLength > MAX_CONTENT_RUNTIME_ARCHIVE_BYTES) {
      return yield* contentRuntimeCiError(
        `Encrypted signed runtime archive exceeds ${MAX_CONTENT_RUNTIME_ARCHIVE_BYTES} bytes.`
      );
    }

    const archiveSha256 = createHash("sha256").update(bytes).digest("hex");
    const byteLength = bytes.byteLength;
    const uploadOperation = "Runtime archive upload capability";
    const uploadControl = yield* postArchiveControl(
      fetcher,
      config.siteUrl,
      CONTENT_RUNTIME_ARCHIVE_UPLOAD_PATH,
      { ...identity(config), claimId },
      credential(config),
      uploadOperation
    );
    if (!uploadControl.ok) {
      return yield* archiveHttpError(uploadOperation, uploadControl.status);
    }
    const { uploadUrl } = yield* decodeControlResponse(
      uploadControl,
      ContentRuntimeArchiveUploadSchema,
      uploadOperation
    );
    const upload = yield* fetchArchive(
      fetcher,
      "Runtime archive upload",
      uploadUrl,
      {
        body: new Blob([new Uint8Array(bytes)], {
          type: CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE,
        }),
        headers: { "content-type": CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE },
        method: "POST",
        redirect: "error",
      }
    );
    if (!upload.ok) {
      return yield* archiveHttpError("Runtime archive upload", upload.status);
    }
    const { storageId } = yield* decodeControlResponse(
      upload,
      ContentRuntimeArchiveStorageResultSchema,
      "Runtime archive upload"
    );
    const finalized = yield* finalizeUpload(
      config,
      {
        ...identity(config),
        archiveSha256,
        byteLength,
        claimId,
        storageId,
      },
      fetcher
    ).pipe(Effect.result);
    if (Result.isSuccess(finalized)) {
      return finalized.success;
    }

    const aborted = yield* abortUpload(
      config,
      claimId,
      storageId,
      fetcher
    ).pipe(Effect.result);
    if (
      Result.isSuccess(aborted) &&
      aborted.success.kind === "canonical" &&
      aborted.success.metadata.archiveSha256 === archiveSha256 &&
      aborted.success.metadata.byteLength === byteLength
    ) {
      return { kind: "unchanged", metadata: aborted.success.metadata } as const;
    }
    return yield* finalized.failure;
  }
);

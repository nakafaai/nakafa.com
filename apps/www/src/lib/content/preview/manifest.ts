import "@tanstack/react-start/server-only";
import { LocalPreviewManifestSchema } from "@nakafa/aksara-contracts/preview/spec";
import { getRequest } from "@tanstack/react-start/server";
import { Effect, Option, Result, Schema } from "effect";
import {
  decodePreviewEnvironment,
  hasPreviewConfig,
  PreviewConfigSchema,
} from "@/lib/content/preview/config";
import { readPreviewEnvironment } from "@/lib/content/preview/environment";
import { PreviewIntegrityError } from "@/lib/content/preview/errors";
import {
  fetchPreviewJson,
  MAX_PREVIEW_MANIFEST_BYTES,
} from "@/lib/content/preview/request";

/** Authenticated current state returned by the local Aksara provider. */
const PreviewSnapshotSchema = Schema.Struct({
  config: PreviewConfigSchema,
  manifest: LocalPreviewManifestSchema,
});
type PreviewSnapshot = typeof PreviewSnapshotSchema.Type;

/** Strictly decodes one current loopback manifest without a runtime. */
function decodeManifest(input: unknown) {
  return Result.mapError(
    Schema.decodeUnknownResult(LocalPreviewManifestSchema)(input, {
      onExcessProperty: "error",
    }),
    () => new PreviewIntegrityError({ check: "manifest" })
  );
}

/** Reads the authenticated snapshot from the local provider: its configuration, then its manifest. */
const loadPreviewSnapshot = Effect.fn("NakafaContent.loadPreviewSnapshot")(
  function* () {
    const config = decodePreviewEnvironment(readPreviewEnvironment());
    if (Result.isFailure(config)) {
      return yield* config.failure;
    }
    const input = yield* fetchPreviewJson(
      config.success,
      config.success.manifestPath,
      MAX_PREVIEW_MANIFEST_BYTES
    );
    const manifest = decodeManifest(input);
    if (Result.isFailure(manifest)) {
      return yield* manifest.failure;
    }
    return { config: config.success, manifest: manifest.success };
  }
);

/** The memo of one request: an effect that loads the snapshot once and answers it to every later reader. */
const createSnapshotMemo = () => Effect.cached(loadPreviewSnapshot());

/** The type of the memo that one request holds. */
type PreviewSnapshotMemo = Effect.Success<
  ReturnType<typeof createSnapshotMemo>
>;

/** The snapshot memo of each request, keyed by its Request object. A WeakMap lets a memo leave with its request. */
const snapshotMemos = new WeakMap<Request, PreviewSnapshotMemo>();

/**
 * The snapshot memo of one request. Every reader of a request awaits the same
 * memo, so the manifest is fetched once per request however many readers run.
 * The lookup and the store happen in one synchronous step, so readers that start
 * together never keep two memos.
 */
const readSnapshotMemo = (request: Request) =>
  Effect.gen(function* () {
    const created = yield* createSnapshotMemo();
    return yield* Effect.sync(() => {
      const existing = snapshotMemos.get(request);
      if (existing !== undefined) {
        return existing;
      }
      snapshotMemos.set(request, created);
      return created;
    });
  });

/** Reads the snapshot of the current request, shared with every other reader of that request. */
const readRequestSnapshot = Effect.fn("NakafaContent.readRequestSnapshot")(
  function* () {
    const memo = yield* readSnapshotMemo(getRequest());
    return yield* memo;
  }
);

/** Reads the snapshot that the root revision listener and the document of one request share. */
export const readPreviewSnapshot = Effect.fn(
  "NakafaContent.readPreviewSnapshot"
)(function* () {
  if (!hasPreviewConfig()) {
    return Option.none<PreviewSnapshot>();
  }
  return Option.some(yield* readRequestSnapshot());
});

/** Reads the current manifest of the local preview, which the refresh handler answers. */
export const readPreviewManifest = Effect.fn(
  "NakafaContent.readPreviewManifest"
)(function* () {
  const snapshot = yield* readRequestSnapshot();
  return snapshot.manifest;
});

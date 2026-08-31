import { SignedContentArtifactSchema } from "@nakafa/aksara-contracts/content";
import { ACTIVE_APP_LOCALES } from "@nakafa/aksara-contracts/locale";
import { ContentProjectionSchema } from "@nakafa/aksara-contracts/projection/spec";
import { quranSourceFileCount } from "@nakafa/aksara-contracts/quran/source";
import {
  ContentReleaseItemSchema,
  PublicationReceiptSchema,
  ReleaseVerificationEvidenceSchema,
  SignedContentReleaseSchema,
} from "@nakafa/aksara-contracts/release";
import { RollbackSnapshotEntrySchema } from "@nakafa/aksara-contracts/release/rollback/spec";
import { ContentRouteItemSchema } from "@nakafa/aksara-contracts/release/route/spec";
import {
  ContentSnapshotManifestSchema,
  ContentSnapshotRowSchema,
} from "@nakafa/aksara-contracts/release/snapshot/data";
import { RendererManifestEnvelopeSchema } from "@nakafa/aksara-contracts/renderer/contract";
import { SignedTryoutRuntimeBundleSchema } from "@nakafa/aksara-contracts/tryout/runtime/spec";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { Effect, Schema } from "effect";

const CurrentContentSnapshotManifestSchema = ContentSnapshotManifestSchema.pipe(
  Schema.check(
    Schema.makeFilter(
      (snapshot) =>
        snapshot.family !== "quran" ||
        (snapshot.manifest.activeAppLocales.length ===
          ACTIVE_APP_LOCALES.length &&
          snapshot.manifest.activeAppLocales.every(
            (locale, index) => locale === ACTIVE_APP_LOCALES[index]
          ) &&
          snapshot.manifest.sourceFileCount ===
            quranSourceFileCount(ACTIVE_APP_LOCALES)),
      {
        message:
          "Expected the complete current Quran locale and source inventory.",
      }
    )
  )
);

/** Parses one stored JSON value without allowing thrown parser failures. */
export const parseStoredJson = Effect.fn("contentRelease.parseStoredJson")(
  (source: string, label = "Stored publication JSON") =>
    Effect.try({
      catch: () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `${label} is not valid JSON.`,
        }),
      try: (): unknown => JSON.parse(source),
    })
);
/** Strictly decodes one signed release from canonical storage JSON. */
export const decodeReleaseJson = Effect.fn("contentRelease.decodeReleaseJson")(
  (source: string) =>
    parseStoredJson(source, "Signed release").pipe(
      Effect.flatMap(
        Schema.decodeUnknownEffect(SignedContentReleaseSchema, {
          onExcessProperty: "error",
        })
      ),
      Effect.mapError(
        () =>
          new ReleaseError({
            code: "CONTENT_RELEASE_INTEGRITY",
            message: "Signed release does not satisfy its exact contract.",
          })
      )
    )
);
/** Strictly decodes one ordered release item from canonical storage JSON. */
export const decodeItemJson = Effect.fn("contentRelease.decodeItemJson")(
  (source: string) =>
    parseStoredJson(source, "Release item").pipe(
      Effect.flatMap(
        Schema.decodeUnknownEffect(ContentReleaseItemSchema, {
          onExcessProperty: "error",
        })
      ),
      Effect.mapError(
        () =>
          new ReleaseError({
            code: "CONTENT_RELEASE_INTEGRITY",
            message: "Release item does not satisfy its exact contract.",
          })
      )
    )
);
/** Strictly decodes one ordered route item from canonical storage JSON. */
export const decodeRouteJson = Effect.fn("contentRelease.decodeRouteJson")(
  (source: string) =>
    parseStoredJson(source, "Release route").pipe(
      Effect.flatMap(
        Schema.decodeUnknownEffect(ContentRouteItemSchema, {
          onExcessProperty: "error",
        })
      ),
      Effect.mapError(
        () =>
          new ReleaseError({
            code: "CONTENT_RELEASE_INTEGRITY",
            message: "Release route does not satisfy its exact contract.",
          })
      )
    )
);
/** Strictly decodes one signed artifact from canonical storage JSON. */
export const decodeArtifactJson = Effect.fn(
  "contentRelease.decodeArtifactJson"
)((source: string) =>
  parseStoredJson(source, "Signed artifact").pipe(
    Effect.flatMap(
      Schema.decodeUnknownEffect(SignedContentArtifactSchema, {
        onExcessProperty: "error",
      })
    ),
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: "Signed artifact does not satisfy its exact contract.",
        })
    )
  )
);
/** Strictly decodes one readable projection from canonical storage JSON. */
export const decodeProjectionJson = Effect.fn(
  "contentRelease.decodeProjectionJson"
)((source: string) =>
  parseStoredJson(source, "Content projection").pipe(
    Effect.flatMap(
      Schema.decodeUnknownEffect(ContentProjectionSchema, {
        onExcessProperty: "error",
      })
    ),
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: "Content projection does not satisfy its exact contract.",
        })
    )
  )
);
/** Strictly decodes server-derived verification evidence from storage JSON. */
export const decodeProofJson = Effect.fn("contentRelease.decodeProofJson")(
  (source: string) =>
    parseStoredJson(source, "Release proof").pipe(
      Effect.flatMap(
        Schema.decodeUnknownEffect(ReleaseVerificationEvidenceSchema, {
          onExcessProperty: "error",
        })
      ),
      Effect.mapError(
        () =>
          new ReleaseError({
            code: "CONTENT_RELEASE_INTEGRITY",
            message: "Release proof does not satisfy its exact contract.",
          })
      )
    )
);
/** Strictly decodes one completed receipt from canonical storage JSON. */
export const decodeReceiptJson = Effect.fn("contentRelease.decodeReceiptJson")(
  (source: string) =>
    parseStoredJson(source, "Publication receipt").pipe(
      Effect.flatMap(
        Schema.decodeUnknownEffect(PublicationReceiptSchema, {
          onExcessProperty: "error",
        })
      ),
      Effect.mapError(
        () =>
          new ReleaseError({
            code: "CONTENT_RELEASE_INTEGRITY",
            message: "Publication receipt does not satisfy its contract.",
          })
      )
    )
);
/** Strictly decodes one canonical prior-state snapshot from storage JSON. */
export const decodeRollbackJson = Effect.fn(
  "contentRelease.decodeRollbackJson"
)((source: string) =>
  parseStoredJson(source, "Rollback snapshot").pipe(
    Effect.flatMap(
      Schema.decodeUnknownEffect(RollbackSnapshotEntrySchema, {
        onExcessProperty: "error",
      })
    ),
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: "Rollback snapshot does not satisfy its exact contract.",
        })
    )
  )
);
/** Strictly decodes one immutable structured-family manifest. */
export const decodeSnapshotJson = Effect.fn(
  "contentRelease.decodeSnapshotJson"
)((source: string) =>
  parseStoredJson(source, "Content snapshot").pipe(
    Effect.flatMap(
      Schema.decodeUnknownEffect(CurrentContentSnapshotManifestSchema, {
        onExcessProperty: "error",
      })
    ),
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: "Content snapshot does not satisfy its exact contract.",
        })
    )
  )
);
/** Strictly decodes one immutable structured-family row. */
export const decodeSnapshotRowJson = Effect.fn(
  "contentRelease.decodeSnapshotRowJson"
)((source: string) =>
  parseStoredJson(source, "Content snapshot row").pipe(
    Effect.flatMap(
      Schema.decodeUnknownEffect(ContentSnapshotRowSchema, {
        onExcessProperty: "error",
      })
    ),
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: "Content snapshot row does not satisfy its exact contract.",
        })
    )
  )
);
/** Strictly decodes one trusted renderer snapshot from canonical JSON. */
export const decodeRendererJson = Effect.fn(
  "contentRelease.decodeRendererJson"
)((source: string) =>
  parseStoredJson(source, "Renderer manifest").pipe(
    Effect.flatMap(
      Schema.decodeUnknownEffect(RendererManifestEnvelopeSchema, {
        onExcessProperty: "error",
      })
    ),
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: "Renderer manifest does not satisfy its exact contract.",
        })
    )
  )
);
/** Strictly decodes one permanent signed try-out runtime bundle. */
export const decodeTryoutRuntimeBundleJson = Effect.fn(
  "contentRelease.decodeTryoutRuntimeBundleJson"
)((source: string) =>
  parseStoredJson(source, "Try-out runtime bundle").pipe(
    Effect.flatMap(
      Schema.decodeUnknownEffect(SignedTryoutRuntimeBundleSchema, {
        onExcessProperty: "error",
      })
    ),
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message:
            "Try-out runtime bundle does not satisfy its exact contract.",
        })
    )
  )
);

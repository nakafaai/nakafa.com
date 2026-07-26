import { SignedContentArtifactSchema } from "@nakafa/aksara-contracts/content";
import {
  ContentProjectionSchema,
  ContentProjectionWireSchema,
} from "@nakafa/aksara-contracts/projection/spec";
import {
  ContentReleaseItemSchema,
  PublicationReceiptSchema,
  ReleaseVerificationEvidenceSchema,
  SignedContentReleaseSchema,
} from "@nakafa/aksara-contracts/release";
import { RollbackSnapshotEntrySchema } from "@nakafa/aksara-contracts/release/rollback";
import { ContentRouteItemSchema } from "@nakafa/aksara-contracts/release/route";
import {
  ContentSnapshotManifestSchema,
  ContentSnapshotRowSchema,
} from "@nakafa/aksara-contracts/release/snapshot-data";
import { RendererManifestEnvelopeSchema } from "@nakafa/aksara-contracts/renderer/contract";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { Effect, Schema } from "effect";

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
        Schema.decodeUnknown(SignedContentReleaseSchema, {
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
        Schema.decodeUnknown(ContentReleaseItemSchema, {
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
        Schema.decodeUnknown(ContentRouteItemSchema, {
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
      Schema.decodeUnknown(SignedContentArtifactSchema, {
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

/** Strictly decodes one content projection from canonical storage JSON. */
export const decodeProjectionJson = Effect.fn(
  "contentRelease.decodeProjectionJson"
)((source: string) =>
  parseStoredJson(source, "Content projection").pipe(
    Effect.flatMap(
      Schema.decodeUnknown(ContentProjectionSchema, {
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

/** Decodes retained published wire data without widening current write paths. */
export const decodeProjectionWireJson = Effect.fn(
  "contentRelease.decodeProjectionWireJson"
)((source: string) =>
  parseStoredJson(source, "Content projection wire").pipe(
    Effect.flatMap(
      Schema.decodeUnknown(ContentProjectionWireSchema, {
        onExcessProperty: "error",
      })
    ),
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: "Content projection wire does not satisfy its contract.",
        })
    )
  )
);

/** Strictly decodes server-derived verification evidence from storage JSON. */
export const decodeProofJson = Effect.fn("contentRelease.decodeProofJson")(
  (source: string) =>
    parseStoredJson(source, "Release proof").pipe(
      Effect.flatMap(
        Schema.decodeUnknown(ReleaseVerificationEvidenceSchema, {
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
        Schema.decodeUnknown(PublicationReceiptSchema, {
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
      Schema.decodeUnknown(RollbackSnapshotEntrySchema, {
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
      Schema.decodeUnknown(ContentSnapshotManifestSchema, {
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
      Schema.decodeUnknown(ContentSnapshotRowSchema, {
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
      Schema.decodeUnknown(RendererManifestEnvelopeSchema, {
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

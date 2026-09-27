import {
  canonicalizeContentProjection,
  familyForProjection,
  projectionArtifactLocale,
} from "@nakafa/aksara-contracts/projection/spec";
import type { ContentReleaseItem } from "@nakafa/aksara-contracts/release";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { hashText } from "@repo/backend/confect/contentRelease/digest";
import {
  ensureDocumentSize,
  READ_MODEL_DOCUMENT_LIMIT,
} from "@repo/backend/confect/contentRelease/document";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  loadExactVersion,
  loadRouteBinding,
} from "@repo/backend/confect/contentRelease/model";
import {
  decodeArtifactJson,
  decodeProjectionJson,
} from "@repo/backend/confect/contentRelease/parse";
import type { WithoutSystemFields } from "convex/server";
import { Effect } from "effect";

type UpsertChange = Extract<
  ContentReleaseItem["change"],
  {
    operation: "upsert";
  }
>;

/** Builds the complete immutable upsert version from staged evidence. */
const upsertVersion = Effect.fn("contentRelease.upsertVersion")(function* (
  row: Docs["contentItems"],
  change: UpsertChange
) {
  const database = yield* DatabaseReader;
  if (!(row.artifactReady && row.projectionReady && row.projectionJson)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Upsert ${row.releaseId}/${row.index} is missing staged bodies.`
    );
  }
  const artifactRow = yield* database
    .table("contentArtifacts")
    .get("by_artifactHash", change.artifactHash)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (!artifactRow) {
    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      `Artifact for ${row.releaseId}/${row.index} is missing.`
    );
  }
  const artifact = yield* decodeArtifactJson(artifactRow.artifactJson);
  const projection = yield* decodeProjectionJson(row.projectionJson);
  const projectionHash = yield* hashText(
    "the content projection",
    canonicalizeContentProjection(projection)
  );
  const binding =
    projection.kind === "question-body"
      ? null
      : yield* loadRouteBinding(
          projection.appLocale,
          projection.publicPath,
          row.sequence
        );
  const hasExpectedRoute =
    projection.kind === "question-body"
      ? binding === null
      : binding?.operation === "bind" &&
        binding.contentKey === row.contentKey &&
        !(
          binding.sequence === row.sequence &&
          binding.releaseId !== row.releaseId
        );
  if (
    artifact.artifactHash !== change.artifactHash ||
    artifact.payload.contentKey !== row.contentKey ||
    artifact.payload.artifactLocale !== row.artifactLocale ||
    artifact.payload.rendererDomain !== change.rendererDomain ||
    familyForProjection(projection) !== change.family ||
    projection.contentKey !== row.contentKey ||
    projectionArtifactLocale(projection) !== row.artifactLocale ||
    !hasExpectedRoute
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Upsert ${row.releaseId}/${row.index} has mismatched staged evidence.`
    );
  }
  const version = {
    artifactHash: change.artifactHash,
    artifactLocale: row.artifactLocale,
    compilerConfigHash: artifact.payload.compilerConfigHash,
    contentKey: row.contentKey,
    delivery: change.delivery,
    family: change.family,
    index: row.index,
    operation: "upsert",
    projectionHash,
    projectionJson: row.projectionJson,
    releaseId: row.releaseId,
    rendererDomain: change.rendererDomain,
    sequence: row.sequence,
    sourceHash: artifact.payload.sourceHash,
    sourcePath: change.sourcePath,
  } satisfies WithoutSystemFields<Docs["contentHeads"]>;
  return version;
});

/** Compares every persisted immutable head field without system metadata. */
function sameVersion(
  stored: Docs["contentHeads"],
  expected: Omit<Docs["contentHeads"], "_creationTime" | "_id">
) {
  return (
    stored.artifactHash === expected.artifactHash &&
    stored.artifactLocale === expected.artifactLocale &&
    stored.compilerConfigHash === expected.compilerConfigHash &&
    stored.contentKey === expected.contentKey &&
    stored.delivery === expected.delivery &&
    stored.family === expected.family &&
    stored.index === expected.index &&
    stored.operation === expected.operation &&
    stored.projectionHash === expected.projectionHash &&
    stored.projectionJson === expected.projectionJson &&
    stored.releaseId === expected.releaseId &&
    stored.rendererDomain === expected.rendererDomain &&
    stored.sequence === expected.sequence &&
    stored.sourceHash === expected.sourceHash &&
    stored.sourcePath === expected.sourcePath
  );
}

/** Inserts one immutable upsert version or validates its idempotent retry. */
export const writeUpsert = Effect.fn("contentRelease.writeUpsert")(function* (
  row: Docs["contentItems"],
  change: UpsertChange
) {
  const writer = yield* DatabaseWriter;
  const version = yield* upsertVersion(row, change);
  const existing = yield* loadExactVersion(
    row.contentKey,
    row.artifactLocale,
    row.sequence
  );
  if (existing) {
    if (!sameVersion(existing, version)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Content version ${row.contentKey}/${row.artifactLocale}/${row.sequence} conflicts.`
      );
    }
  } else {
    yield* ensureDocumentSize(
      "Immutable content head",
      version,
      READ_MODEL_DOCUMENT_LIMIT
    );
    yield* writer.table("contentHeads").insert(version).pipe(Effect.orDie);
  }
});

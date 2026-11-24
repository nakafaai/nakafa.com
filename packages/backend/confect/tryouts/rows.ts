import type { AssessmentRowKind } from "@nakafa/aksara-contracts/assessment/snapshot";
import { AssessmentRowSchema } from "@nakafa/aksara-contracts/assessment/snapshot";
import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  loadRelease,
  loadState,
} from "@repo/backend/confect/contentRelease/model";
import { Effect, Option, Schema } from "effect";

/** The rows of a snapshot by kind, so each kind decodes with its own schema. */
const Rows = AssessmentRowSchema.pipe(Schema.toTaggedUnion("kind"));

/**
 * The stored text of one row: the snapshot row ingress wrote, its family, and the record with the row
 * and its hash. The row decodes by its kind afterwards.
 */
const StoredRowText = Schema.fromJsonString(
  Schema.Struct({
    family: Schema.Literal("assessment"),
    record: Schema.Struct({ row: Schema.Unknown, rowHash: Schema.String }),
  })
);

/**
 * Decodes one stored row as a row of `kind`. A missing row, a text that is no row, and a row of
 * another kind fail, so a caller holds exactly the row it asked for. Ingress verified every row hash
 * at activation, so each failure is a broken snapshot, never a learner's mistake.
 */
export const decodeAs = Effect.fn("tryouts.rows.decodeAs")(function* <
  K extends AssessmentRowKind,
>(kind: K, stored: Option.Option<Docs["assessmentRows"]>) {
  if (Option.isNone(stored)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `The assessment snapshot holds no ${kind} row the try-out names.`
    );
  }
  return yield* Schema.decodeEffect(StoredRowText)(stored.value.rowJson).pipe(
    Effect.flatMap(({ record }) =>
      Schema.decodeUnknownEffect(Rows.cases[kind])(record.row)
    ),
    Effect.catchTag("SchemaError", () =>
      releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `A stored ${kind} row is not an assessment ${kind} row.`
      )
    )
  );
});

/**
 * Reads one row of a content-addressed kind by its version hash: an item version, a stimulus
 * version, or a key. The same hash names the same content in every snapshot that holds it, so the
 * first stored row serves.
 */
const readByHash = Effect.fn("tryouts.rows.readByHash")(function* <
  K extends "item" | "key" | "stimulus",
>(kind: K, versionHash: string) {
  const stored = yield* (yield* DatabaseReader)
    .table("assessmentRows")
    .index("by_kind_and_versionHash_and_language", (index) =>
      index.eq("kind", kind).eq("versionHash", versionHash)
    )
    .first()
    .pipe(Effect.catchTag("DocumentDecodeError", Effect.die));
  return yield* decodeAs(kind, stored);
});

/** Reads the item version an attempt froze, by its hash. */
export const readItemVersion = Effect.fn("tryouts.rows.readItemVersion")(
  function* (versionHash: string) {
    return (yield* readByHash("item", versionHash)).version;
  }
);

/** Reads the key of the item version an attempt froze, by the version's hash. */
export const readItemKey = Effect.fn("tryouts.rows.readItemKey")(function* (
  versionHash: string
) {
  return (yield* readByHash("key", versionHash)).key;
});

/** Reads the stimulus version an item version was written against, by its hash. */
export const readStimulus = Effect.fn("tryouts.rows.readStimulus")(function* (
  versionHash: string
) {
  return (yield* readByHash("stimulus", versionHash)).version;
});

/**
 * Reads the active release's assessment snapshot id once per query (one state row and one release row),
 * or none before any release activates an assessment snapshot.
 */
export const findActiveExplanationSnapshotId = Effect.fn(
  "tryouts.rows.findActiveExplanationSnapshotId"
)(function* () {
  const releaseId = (yield* loadState())?.activeReleaseId;
  if (releaseId === undefined) {
    return Option.none<string>();
  }
  const release = yield* loadRelease(releaseId);
  return Option.fromNullOr(
    release.snapshotTransitions.assessment.resultSnapshotId
  );
});

/** Reads one explanation row from one exact snapshot through its point-lookup identity index. */
const findExplanationInSnapshot = Effect.fn(
  "tryouts.rows.findExplanationInSnapshot"
)(function* (snapshotId: string, versionHash: string, language: AppLocaleCode) {
  const stored = yield* (yield* DatabaseReader)
    .table("assessmentRows")
    .index("by_snapshotId_and_kind_and_identity", (index) =>
      index
        .eq("snapshotId", snapshotId)
        .eq("kind", "explanation")
        .eq("identity", `${versionHash}\0${language}`)
    )
    .first()
    .pipe(Effect.catchTag("DocumentDecodeError", Effect.die));
  if (Option.isNone(stored)) {
    return Option.none();
  }
  const { explanation } = yield* decodeAs("explanation", stored);
  return Option.some(explanation.document);
});

/**
 * Reads the explanation of an item version in one app locale from the active assessment snapshot through
 * an exact O(1) point lookup, so updated explanations take effect immediately and candidate or aborted
 * snapshots never leak. When the version no longer exists in the active snapshot (or no snapshot is active),
 * falls back to one point lookup in the historical snapshot the attempt or session froze. A stored row that
 * is broken fails.
 */
export const readExplanation = Effect.fn("tryouts.rows.readExplanation")(
  function* (input: {
    readonly activeSnapshotId: Option.Option<string>;
    readonly fallbackSnapshotId?: string | undefined;
    readonly language: AppLocaleCode;
    readonly versionHash: string;
  }) {
    if (Option.isSome(input.activeSnapshotId)) {
      const current = yield* findExplanationInSnapshot(
        input.activeSnapshotId.value,
        input.versionHash,
        input.language
      );
      if (Option.isSome(current)) {
        return current;
      }
    }
    if (
      input.fallbackSnapshotId !== undefined &&
      (!Option.isSome(input.activeSnapshotId) ||
        input.activeSnapshotId.value !== input.fallbackSnapshotId)
    ) {
      return yield* findExplanationInSnapshot(
        input.fallbackSnapshotId,
        input.versionHash,
        input.language
      );
    }
    return Option.none();
  }
);

/** Reads one row of a snapshot by its kind and identity, such as a paper or a profile by identifier. */
const readByIdentity = Effect.fn("tryouts.rows.readByIdentity")(function* <
  K extends AssessmentRowKind,
>(snapshotId: string, kind: K, identity: string) {
  const stored = yield* (yield* DatabaseReader)
    .table("assessmentRows")
    .index("by_snapshotId_and_kind_and_identity", (index) =>
      index
        .eq("snapshotId", snapshotId)
        .eq("kind", kind)
        .eq("identity", identity)
    )
    .first()
    .pipe(Effect.catchTag("DocumentDecodeError", Effect.die));
  return yield* decodeAs(kind, stored);
});

/** Reads the paper a set names in a snapshot, with its hash. A paper held by another hash is a broken snapshot. */
export const readPaper = Effect.fn("tryouts.rows.readPaper")(function* (
  snapshotId: string,
  reference: { readonly hash: string; readonly id: string }
) {
  const { hash, paper } = yield* readByIdentity(
    snapshotId,
    "paper",
    reference.id
  );
  if (hash !== reference.hash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `A set names paper ${reference.id} by another hash than the snapshot holds.`
    );
  }
  return { hash, paper };
});

/**
 * Reads the exam profile a paper follows in a snapshot, with its hash. A profile held by another hash
 * is a broken snapshot.
 */
export const readProfile = Effect.fn("tryouts.rows.readProfile")(function* (
  snapshotId: string,
  reference: { readonly hash: string; readonly id: string }
) {
  const { hash, profile } = yield* readByIdentity(
    snapshotId,
    "profile",
    reference.id
  );
  if (hash !== reference.hash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `A paper names profile ${reference.id} by another hash than the snapshot holds.`
    );
  }
  return { hash, profile };
});

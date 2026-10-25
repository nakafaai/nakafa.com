import refs from "@repo/backend/confect/_generated/refs";
import {
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { embedBatch } from "@repo/backend/confect/contents/sections/embed";
import type {
  SectionDocument,
  SectionDraft,
  SectionFields,
} from "@repo/backend/confect/contents/sections/schema";
import { GatewayFailure } from "@repo/backend/confect/gateway/failure";
import { embeddingModelId } from "@repo/backend/confect/gateway/model";
import { localeValidator } from "@repo/backend/confect/lib/validators/contents";
import { sha256Hex } from "@repo/utilities/digest";
import {
  Array as Arr,
  Effect,
  HashMap,
  Number as Num,
  Option,
  Schema,
} from "effect";

/**
 * A document whose sections the embedder failed to take, and the gateway's
 * failure for them. The build stops at it, and the failure names the document.
 */
export class DocumentEmbedFailure extends Schema.TaggedError<DocumentEmbedFailure>()(
  "DocumentEmbedFailure",
  {
    appLocale: localeValidator,
    contentKey: Schema.String,
    failure: GatewayFailure,
  }
) {}

/** Names the row of a section among all rows of the index: its language and its place. */
function rowKeyOf({ appLocale, contentKey, ordinal }: SectionDraft) {
  return `${appLocale}/${contentKey}#${ordinal}`;
}

/** Gives a section the hash of its text. */
const withHash = (section: SectionFields) =>
  sha256Hex(section.text).pipe(
    Effect.orDie,
    Effect.map((hash): SectionDraft => ({ ...section, hash }))
  );

/**
 * Makes the index hold the given documents for one release, one document at a
 * time: each embeds the sections whose text the index does not hold yet, and
 * then stores itself in one transaction, which records its version beside its
 * sections. A text that its document holds already, at whatever place, is not
 * sent to the embedder again, and a section whose row is the same is not
 * written again. A section that the model refuses, or that it cannot embed
 * while it takes the probe text, is left out of the index, which counts it as
 * missing. The answer says how many sections were embedded, kept, missing,
 * written, and how many rows were removed, and whether the release stopped being
 * the active one, in which case nothing was stored.
 * An embedding failure stops the call with the document it belongs to.
 */
export const syncDocuments = Effect.fn("contents.sections.sync")(function* (
  releaseId: string,
  documents: readonly SectionDocument[]
) {
  const results = yield* Effect.forEach(documents, (document) =>
    syncDocument(releaseId, document)
  );
  const total = (
    field: "embedded" | "kept" | "missing" | "removed" | "written"
  ) => Num.sumAll(Arr.map(results, (result) => result[field]));
  return {
    embedded: total("embedded"),
    kept: total("kept"),
    missing: total("missing"),
    removed: total("removed"),
    stale: Arr.some(results, ({ stale }) => stale),
    written: total("written"),
  };
});

/** Syncs one document: embeds what its index lacks, then stores it. */
const syncDocument = Effect.fn("contents.sections.syncDocument")(function* (
  releaseId: string,
  { sections, ...source }: SectionDocument
) {
  const { runMutation } = yield* MutationRunner;
  const { runQuery } = yield* QueryRunner;
  const drafts = yield* Effect.forEach(sections, withHash);
  // One check for the document, which asks about the hash of each of its
  // sections and sends no text.
  const known = yield* runQuery(refs.internal.contents.sections.rows.stored, {
    appLocale: source.appLocale,
    contentKey: source.contentKey,
    hashes: Arr.map(drafts, ({ hash }) => hash),
    model: embeddingModelId,
  }).pipe(Effect.catchTag("SchemaError", Effect.die));
  const pending = Arr.map(
    Arr.filter(Arr.zip(drafts, known), ([, isKnown]) => !isKnown),
    ([draft]) => draft
  );
  const vectors = yield* embedBatch(pending).pipe(
    Effect.mapError(
      (failure) =>
        new DocumentEmbedFailure({
          appLocale: source.appLocale,
          contentKey: source.contentKey,
          failure,
        })
    )
  );
  const embeddings = HashMap.fromIterable(
    Arr.getSomes(
      Arr.zipWith(pending, vectors, (draft, vector) =>
        Option.map(vector, (embedding) => [rowKeyOf(draft), embedding] as const)
      )
    )
  );
  const stored = yield* runMutation(refs.internal.contents.sections.rows.save, {
    model: embeddingModelId,
    releaseId,
    sections: Arr.map(drafts, (draft) =>
      Option.match(HashMap.get(embeddings, rowKeyOf(draft)), {
        onNone: () => draft,
        onSome: (embedding) => ({ ...draft, embedding }),
      })
    ),
    source,
  }).pipe(Effect.catchTag("SchemaError", Effect.die));
  return {
    embedded: Arr.length(Arr.getSomes(vectors)),
    kept: stored.kept,
    missing: stored.missing,
    removed: stored.removed,
    stale: stored.stale,
    written: stored.written,
  };
});

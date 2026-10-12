import refs from "@repo/backend/confect/_generated/refs";
import {
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { embedDrafts } from "@repo/backend/confect/contents/sections/embed";
import type {
  SectionDocument,
  SectionDraft,
  SectionFields,
} from "@repo/backend/confect/contents/sections/schema";
import { embeddingModelId } from "@repo/backend/confect/gateway/model";
import { sha256Hex } from "@repo/utilities/digest";
import { Array as Arr, Effect, HashMap, Number as Num, Option } from "effect";

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
 * Makes the index hold the given documents for one release: it embeds the
 * sections whose text the index does not hold yet, in bounded batches across
 * all the documents, and then stores each document in one transaction, which
 * records its version beside its sections. A text that its document holds
 * already, at whatever place, is not sent to the embedder again, and a section
 * whose row is the same is not written again. A section whose text the model
 * refuses is left out of the index, which counts it as missing. The answer
 * says how many sections were embedded, kept, missing, written, and how many
 * rows were removed, and whether the release stopped being the active one, in
 * which case nothing was stored.
 */
export const syncDocuments = Effect.fn("contents.sections.sync")(function* (
  releaseId: string,
  documents: readonly SectionDocument[]
) {
  const { runMutation } = yield* MutationRunner;
  const { runQuery } = yield* QueryRunner;
  const hashed = yield* Effect.forEach(documents, ({ sections, ...source }) =>
    Effect.map(Effect.forEach(sections, withHash), (drafts) => ({
      drafts,
      source,
    }))
  );
  // One check for each document, which asks about the hash of each of its
  // sections and sends no text.
  const known = yield* Effect.forEach(hashed, ({ drafts, source }) =>
    runQuery(refs.internal.contents.sections.rows.stored, {
      appLocale: source.appLocale,
      contentKey: source.contentKey,
      hashes: Arr.map(drafts, ({ hash }) => hash),
      model: embeddingModelId,
    }).pipe(Effect.catchTag("SchemaError", Effect.die))
  );
  const pending = Arr.flatten(
    Arr.zipWith(hashed, known, ({ drafts }, found) =>
      Arr.map(
        Arr.filter(Arr.zip(drafts, found), ([, isKnown]) => !isKnown),
        ([draft]) => draft
      )
    )
  );
  const vectors = yield* embedDrafts(pending);
  const embeddings = HashMap.fromIterable(
    Arr.getSomes(
      Arr.zipWith(pending, vectors, (draft, vector) =>
        Option.map(vector, (embedding) => [rowKeyOf(draft), embedding] as const)
      )
    )
  );
  const results = yield* Effect.forEach(
    hashed,
    ({ drafts: sections, source }) =>
      runMutation(refs.internal.contents.sections.rows.save, {
        model: embeddingModelId,
        releaseId,
        sections: Arr.map(sections, (draft) =>
          Option.match(HashMap.get(embeddings, rowKeyOf(draft)), {
            onNone: () => draft,
            onSome: (embedding) => ({ ...draft, embedding }),
          })
        ),
        source,
      }).pipe(Effect.catchTag("SchemaError", Effect.die))
  );
  const total = (field: "kept" | "missing" | "removed" | "written") =>
    Num.sumAll(Arr.map(results, (result) => result[field]));
  return {
    embedded: Arr.length(Arr.getSomes(vectors)),
    kept: total("kept"),
    missing: total("missing"),
    removed: total("removed"),
    stale: Arr.some(results, ({ stale }) => stale),
    written: total("written"),
  };
});

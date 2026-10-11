import refs from "@repo/backend/confect/_generated/refs";
import {
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { embedDrafts } from "@repo/backend/confect/contents/sections/embed";
import {
  SECTIONS_PER_CHECK,
  SECTIONS_PER_MUTATION,
} from "@repo/backend/confect/contents/sections/limits";
import type { SectionFields } from "@repo/backend/confect/contents/sections/schema";
import { embeddingModelId } from "@repo/backend/confect/gateway/model";
import { sha256Hex } from "@repo/utilities/digest";
import { Array as Arr, Effect, Option } from "effect";

/**
 * Makes the index hold the given sections for one release: it embeds those
 * whose text the index does not hold yet, in bounded batches, and stores all of
 * them a bounded number at a time. Sections the index holds already are not
 * sent to the embedder again, and a section whose text the model refuses is
 * stored without a vector, which counts it as missing. The answer says how
 * many sections were embedded, kept, missing, and written, and whether the
 * release stopped being the active one, in which case nothing was stored.
 */
export const syncSections = Effect.fn("contents.sections.sync")(function* (
  releaseId: string,
  sections: readonly SectionFields[]
) {
  const { runMutation } = yield* MutationRunner;
  const { runQuery } = yield* QueryRunner;
  const drafts = yield* Effect.forEach(sections, (section) =>
    sha256Hex(section.text).pipe(
      Effect.orDie,
      Effect.map((hash) => ({ ...section, hash }))
    )
  );
  // The arguments are encoded through `knownInputValidator`, which keeps the
  // key of each section and drops its text, so only the keys travel.
  const known = Arr.flatten(
    yield* Effect.forEach(Arr.chunksOf(drafts, SECTIONS_PER_CHECK), (chunk) =>
      runQuery(refs.internal.contents.sections.rows.stored, {
        model: embeddingModelId,
        sections: chunk,
      }).pipe(Effect.catchTag("SchemaError", Effect.die))
    )
  );
  const entries = Arr.zip(drafts, known);
  const pending = Arr.map(
    Arr.filter(entries, ([, isKnown]) => !isKnown),
    ([draft]) => draft
  );
  const vectors = yield* embedDrafts(pending);
  const stored = Arr.appendAll(
    Arr.map(
      Arr.filter(entries, ([, isKnown]) => isKnown),
      ([draft]) => draft
    ),
    Arr.zipWith(pending, vectors, (draft, vector) =>
      Option.match(vector, {
        onNone: () => draft,
        onSome: (embedding) => ({ ...draft, embedding }),
      })
    )
  );
  const results = yield* Effect.forEach(
    Arr.chunksOf(stored, SECTIONS_PER_MUTATION),
    (chunk) =>
      runMutation(refs.internal.contents.sections.rows.save, {
        model: embeddingModelId,
        releaseId,
        sections: chunk,
      }).pipe(Effect.catchTag("SchemaError", Effect.die))
  );
  const total = (field: "kept" | "missing" | "written") =>
    Arr.reduce(results, 0, (sum, result) => sum + result[field]);
  return {
    embedded: Arr.length(Arr.getSomes(vectors)),
    kept: total("kept"),
    missing: total("missing"),
    stale: Arr.some(results, ({ stale }) => stale),
    written: total("written"),
  };
});

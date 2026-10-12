import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  fuseRanks,
  placeOf,
} from "@repo/backend/confect/contents/sections/fuse";
import type {
  Hit,
  hitsInputValidator,
} from "@repo/backend/confect/contents/sections/hits.spec";
import {
  CANDIDATES_PER_LEG,
  SEARCH_VERIFY_SLACK,
} from "@repo/backend/confect/contents/sections/limits";
import { isReady } from "@repo/backend/confect/contents/sections/state";
import { textQuery } from "@repo/backend/confect/contents/sections/terms";
import { embeddingModelId } from "@repo/backend/confect/gateway/model";
import type { localeValidator } from "@repo/backend/confect/lib/validators/contents";
import { articleLayer } from "@repo/backend/content/article/confect";
import { materialLayer } from "@repo/backend/content/material/confect";
import { quranLayer } from "@repo/backend/content/quran/confect";
import { readContentReference } from "@repo/backend/content/reference/read";
import { tryoutLayer } from "@repo/backend/content/tryout/confect";
import { Array as Arr, Effect, HashMap, Layer, Option } from "effect";

type Section = Docs["contentSections"];

/**
 * The same place of the same document in the language of the learner, when
 * that language has it with the same sections; the section as found otherwise.
 */
const inLocale = Effect.fn("contents.sections.inLocale")(function* (
  section: Section,
  locale: typeof localeValidator.Type
) {
  if (section.appLocale === locale) {
    return section;
  }
  const counterpart = yield* (yield* DatabaseReader)
    .table("contentSections")
    .get(
      "by_appLocale_and_contentKey_and_ordinal",
      locale,
      section.contentKey,
      section.ordinal
    )
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  return counterpart !== null && counterpart.count === section.count
    ? counterpart
    : section;
});

/**
 * The verified reference of the document that holds a section, or none when
 * that document is not published any more.
 */
const referenceOf = Effect.fn("contents.sections.referenceOf")(function* (
  section: Section
) {
  const reference = yield* readContentReference({
    appLocale: section.appLocale,
    kind: "route",
    publicPath: section.publicPath,
  }).pipe(
    Effect.provide(
      Layer.mergeAll(articleLayer, materialLayer, quranLayer, tryoutLayer)
    )
  );
  return Option.fromNullishOr(reference);
});

/** A section as a pointer, with the verified reference of its document. */
function toHit(section: Section, reference: Hit["reference"]): Hit {
  return {
    anchor: section.anchor,
    appLocale: section.appLocale,
    contentKey: section.contentKey,
    excerpt: section.excerpt,
    headingPath: section.headingPath,
    ordinal: section.ordinal,
    reference,
  };
}

/**
 * Ranks the sections that the vector search found, with those that the words
 * of the question find, keeps the best section of each document, and returns
 * the best `limit` of them in the language of the learner. A document with
 * many sections that rank well, such as a long surah, then takes one place
 * and does not crowd the other documents out of the answer. A section found
 * by words may come from any language, and the same place of the document in
 * the learner's language is returned for it when there is one. Only sections
 * of documents that are still published are returned. A section that both
 * searches found is read once. The answer is
 * `empty` when the vector search found nothing in the index, and when the index
 * may not answer any more. `state.ready` asks that before a question is
 * embedded, in a transaction of its own, and a release can become active
 * between that answer and this query. The sections found then belong to a
 * release that is gone while the build of the new one rewrites the same rows.
 * So the state is read again here, in the transaction that reads the sections.
 */
export const resolveHits = Effect.fn("contents.sections.resolveHits")(
  function* (input: typeof hitsInputValidator.Type) {
    if (
      Arr.isReadonlyArrayEmpty(input.ids) ||
      !(yield* isReady(embeddingModelId))
    ) {
      return { kind: "empty" as const };
    }
    const table = (yield* DatabaseReader).table("contentSections");
    const terms = textQuery(input.query);
    const byWords =
      terms === ""
        ? []
        : yield* table
            .search("search_text", (index) =>
              input.section === undefined
                ? index.search("text", terms)
                : index.search("text", terms).eq("section", input.section)
            )
            .take(CANDIDATES_PER_LEG)
            .pipe(Effect.orDie);
    const read = HashMap.fromIterable(
      Arr.map(byWords, (row) => [row._id, row] as const)
    );
    const byMeaning = Arr.getSomes(
      yield* Effect.forEach(input.ids, (id) =>
        Option.match(HashMap.get(read, id), {
          onNone: () =>
            table.get(id).pipe(
              Effect.asSome,
              Effect.catchTag("GetByIdFailure", () =>
                Effect.succeed(Option.none<Section>())
              ),
              Effect.orDie
            ),
          onSome: (row) => Effect.succeedSome(row),
        })
      )
    );
    if (Arr.isReadonlyArrayEmpty(byMeaning)) {
      return { kind: "empty" as const };
    }
    const best = Arr.dedupeWith(
      fuseRanks([byMeaning, byWords], placeOf),
      (left, right) => left.contentKey === right.contentKey
    );
    const hits = Arr.getSomes(
      yield* Effect.forEach(
        Arr.take(best, input.limit + SEARCH_VERIFY_SLACK),
        (ranked) =>
          Effect.gen(function* () {
            const section = yield* inLocale(ranked, input.locale);
            return Option.map(yield* referenceOf(section), (reference) =>
              toHit(section, reference)
            );
          }),
        { concurrency: "unbounded" }
      )
    );
    return { hits: Arr.take(hits, input.limit), kind: "hits" as const };
  }
);

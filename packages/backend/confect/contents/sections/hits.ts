import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { fuseRanks } from "@repo/backend/confect/contents/sections/fuse";
import type {
  Hit,
  hitsInputValidator,
} from "@repo/backend/confect/contents/sections/hits.spec";
import {
  CANDIDATES_PER_LEG,
  SEARCH_VERIFY_SLACK,
} from "@repo/backend/confect/contents/sections/limits";
import { textQuery } from "@repo/backend/confect/contents/sections/terms";
import type { localeValidator } from "@repo/backend/confect/lib/validators/contents";
import { articleLayer } from "@repo/backend/content/article/confect";
import { materialLayer } from "@repo/backend/content/material/confect";
import { quranLayer } from "@repo/backend/content/quran/confect";
import { readContentReference } from "@repo/backend/content/reference/read";
import { tryoutLayer } from "@repo/backend/content/tryout/confect";
import { Array as Arr, Effect, Layer, Option } from "effect";

type Section = Docs["contentSections"];

/** The section of a document as one place, whatever its language. */
const placeOf = ({ contentKey, ordinal }: Section) =>
  `${contentKey}#${ordinal}`;

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
 * A section as a pointer, with the verified reference of its document, or
 * nothing when that document is not published any more.
 */
const toHit = Effect.fn("contents.sections.toHit")(function* (
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
  return Option.map(
    Option.fromNullishOr(reference),
    (found): Hit => ({
      anchor: section.anchor,
      appLocale: section.appLocale,
      contentKey: section.contentKey,
      excerpt: section.excerpt,
      headingPath: section.headingPath,
      ordinal: section.ordinal,
      reference: found,
    })
  );
});

/**
 * Ranks the sections that the vector search found, with those that the words
 * of the question find, and returns the best `limit` of them in the language
 * of the learner. A section found by words may come from any language, and
 * the same place of the document in the learner's language is returned for it
 * when there is one. Only sections of documents that are still published are
 * returned. The answer is `empty` when the vector search found nothing, which
 * means the index holds no section for it.
 */
export const resolveHits = Effect.fn("contents.sections.resolveHits")(
  function* (input: typeof hitsInputValidator.Type) {
    const reader = yield* DatabaseReader;
    const table = reader.table("contentSections");
    const byMeaning = Arr.getSomes(
      yield* Effect.forEach(input.ids, (id) =>
        table.get(id).pipe(
          Effect.asSome,
          Effect.catchTag("GetByIdFailure", () =>
            Effect.succeed(Option.none<Section>())
          ),
          Effect.orDie
        )
      )
    );
    if (Arr.isReadonlyArrayEmpty(byMeaning)) {
      return { kind: "empty" as const };
    }
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
    const ranked = Arr.take(
      fuseRanks([byMeaning, byWords], placeOf),
      input.limit + SEARCH_VERIFY_SLACK
    );
    const sections = yield* Effect.forEach(ranked, (section) =>
      inLocale(section, input.locale)
    );
    const hits = yield* Effect.forEach(sections, toHit, {
      concurrency: "unbounded",
    });
    return {
      hits: Arr.take(Arr.getSomes(hits), input.limit),
      kind: "hits" as const,
    };
  }
);

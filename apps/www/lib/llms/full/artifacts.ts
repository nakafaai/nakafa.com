import { availableParallelism } from "node:os";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { NUMBER_SEGMENT } from "@/lib/llms/constants";
import { getLlmsSourceMarkdownText } from "@/lib/llms/content";
import { getLocalizedLlmsEntries, type LlmsEntry } from "@/lib/llms/entries";
import {
  LLMS_FULL_MANIFEST_PATH,
  LLMS_FULL_SHARD_TARGET_BYTES,
  LLMS_FULL_TEXT_PATH,
} from "@/lib/llms/full/constants";
import {
  buildFullManifest,
  buildRootFullText,
  buildShard,
  buildTextArtifact,
  flattenShards,
} from "@/lib/llms/full/shards";
import type { LlmsFullDocument } from "@/lib/llms/full/types";

const LLMS_FULL_CONCURRENCY = availableParallelism();

interface LlmsFullArtifactOptions {
  shardTargetBytes?: number;
}

/** Builds a full-document snapshot from existing llms markdown sources. */
export const getLlmsFullText = Effect.fn("llms.getLlmsFullText")(function* () {
  const artifacts = yield* getLlmsFullArtifacts();

  return artifacts.root.text;
});

/** Builds every generated llms-full artifact from existing markdown sources. */
export const getLlmsFullArtifacts = Effect.fn("llms.getLlmsFullArtifacts")(
  function* (options: LlmsFullArtifactOptions = {}) {
    const documents = yield* getLlmsFullDocuments();
    const shardTargetBytes =
      options.shardTargetBytes ?? LLMS_FULL_SHARD_TARGET_BYTES;
    const locales = [...new Set(documents.map((document) => document.locale))];
    const localeShards = locales.map((locale) => {
      const scopedDocuments = documents.filter(
        (document) => document.locale === locale
      );

      return buildShard({
        documents: scopedDocuments,
        locale,
        prefixParts: [],
        shardTargetBytes,
      });
    });
    const shardArtifacts = flattenShards(localeShards).map((shard) =>
      buildTextArtifact(shard.path, shard.text)
    );
    const root = buildTextArtifact(
      LLMS_FULL_TEXT_PATH,
      buildRootFullText({ documents, localeShards })
    );
    const manifestData = buildFullManifest({
      documents,
      root,
      shards: localeShards,
    });
    const manifest = buildTextArtifact(
      LLMS_FULL_MANIFEST_PATH,
      `${JSON.stringify(manifestData, null, 2)}\n`
    );

    return {
      manifest,
      manifestData,
      root,
      shards: shardArtifacts,
    };
  }
);

/** Loads every page-level full-document chunk for every supported locale. */
const getLlmsFullDocuments = Effect.fn("llms.getLlmsFullDocuments")(
  function* () {
    const localeDocumentSets = yield* Effect.forEach(
      routing.locales,
      (locale) =>
        Effect.gen(function* () {
          const entries = yield* Effect.tryPromise(() =>
            getLocalizedLlmsEntries(locale)
          );

          return yield* getLocaleDocuments({ entries, locale });
        }),
      { concurrency: "unbounded" }
    );

    return localeDocumentSets.flat();
  }
);

/** Builds ordered full-document chunks for one locale. */
function getLocaleDocuments({
  entries,
  locale,
}: {
  entries: LlmsEntry[];
  locale: Locale;
}) {
  return Effect.forEach(
    entries,
    (entry) => getEntryDocument({ entry, locale }),
    {
      concurrency: LLMS_FULL_CONCURRENCY,
    }
  ).pipe(
    Effect.map((documents) =>
      documents.flatMap((document) => (document ? [document] : []))
    )
  );
}

/** Builds one full-document chunk for a markdown-capable sitemap entry. */
function getEntryDocument({
  entry,
  locale,
}: {
  entry: LlmsEntry;
  locale: Locale;
}) {
  if (!entry.href.endsWith(".md") || isDuplicateExerciseQuestionEntry(entry)) {
    return Effect.succeed(null);
  }

  return Effect.gen(function* () {
    const text = yield* Effect.tryPromise(() =>
      getLlmsSourceMarkdownText({
        cleanSlug: entry.route.slice(1),
        locale,
      })
    );

    if (!text) {
      return null;
    }

    const documentText = `Markdown URL: ${entry.href}\n\n${text.trim()}`;

    return {
      bytes: Buffer.byteLength(documentText, "utf8"),
      locale,
      section: entry.section,
      segments: entry.segments,
      text: documentText,
    } satisfies LlmsFullDocument;
  });
}

/** Keeps llms-full from repeating questions already present in set markdown. */
function isDuplicateExerciseQuestionEntry(entry: LlmsEntry) {
  if (entry.section !== "exercises") {
    return false;
  }

  const lastSegment = entry.segments.at(-1);
  return lastSegment !== undefined && NUMBER_SEGMENT.test(lastSegment);
}

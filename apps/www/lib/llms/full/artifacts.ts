import { availableParallelism } from "node:os";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import type { LlmsSection } from "@/lib/llms/constants";
import { getLlmsSourceMarkdownText } from "@/lib/llms/content";
import { getContentPageLlmsEntries, type LlmsEntry } from "@/lib/llms/entries";
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
import {
  type ContentSitemapPage,
  readSitemapPageDescriptors,
} from "@/lib/sitemap/routes";

const LLMS_FULL_ROUTE_CONCURRENCY = Math.max(
  1,
  Math.min(availableParallelism(), 2)
);
const LLMS_FULL_ENTRY_CONCURRENCY = 2;

interface LlmsFullArtifactOptions {
  shardTargetBytes?: number;
}

/** Builds the compact full-corpus entrypoint from existing llms markdown sources. */
export const getLlmsFullText = Effect.fn("llms.getLlmsFullText")(function* () {
  const artifacts = yield* getLlmsFullArtifacts();

  return artifacts.root.text;
});

/** Builds every generated llms-full artifact from existing markdown sources. */
export const getLlmsFullArtifacts = Effect.fn("llms.getLlmsFullArtifacts")(
  function* (options: LlmsFullArtifactOptions = {}) {
    const shardTargetBytes =
      options.shardTargetBytes ?? LLMS_FULL_SHARD_TARGET_BYTES;
    const shards = yield* buildLlmsFullShards(shardTargetBytes);
    const shardArtifacts = flattenShards(shards).map((shard) =>
      buildTextArtifact(shard.path, shard.text)
    );
    const root = buildTextArtifact(
      LLMS_FULL_TEXT_PATH,
      buildRootFullText({ shards })
    );
    const manifestData = buildFullManifest({
      root,
      shards,
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

/** Builds non-empty full-content shards from materialized route pages. */
const buildLlmsFullShards = Effect.fn("llms.buildLlmsFullShards")(function* (
  shardTargetBytes: number
) {
  const descriptors = yield* getLlmsFullRoutePageDescriptors();
  const shardSets = yield* Effect.forEach(
    descriptors,
    (descriptor) =>
      Effect.gen(function* () {
        const entries = yield* getContentPageLlmsEntries(descriptor);
        const documents = yield* getLocaleDocuments({
          entries,
          locale: descriptor.locale,
        });

        if (documents.length === 0) {
          return null;
        }

        return buildShard({
          documents,
          locale: descriptor.locale,
          prefixParts: [descriptor.section, "page", String(descriptor.page)],
          shardTargetBytes,
        });
      }),
    { concurrency: LLMS_FULL_ROUTE_CONCURRENCY }
  );

  return shardSets.flatMap((shard) => (shard ? [shard] : []));
});

/** Lists materialized route pages that can own llms-full content documents. */
function getLlmsFullRoutePageDescriptors() {
  return readSitemapPageDescriptors().pipe(
    Effect.map((descriptors) =>
      descriptors.filter(
        (descriptor): descriptor is ContentSitemapPage =>
          "section" in descriptor && isContentSection(descriptor.section)
      )
    )
  );
}

/** Checks whether one llms section can contain content markdown documents. */
function isContentSection(
  section: LlmsSection
): section is Exclude<LlmsSection, "site"> {
  return section !== "site";
}

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
      concurrency: LLMS_FULL_ENTRY_CONCURRENCY,
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
  if (!entry.href.endsWith(".md")) {
    return Effect.succeed(null);
  }

  return Effect.gen(function* () {
    const text = yield* getLlmsSourceMarkdownText({
      cleanSlug: entry.route.slice(1),
      locale,
    });

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

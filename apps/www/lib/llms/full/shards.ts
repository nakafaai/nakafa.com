import { routing } from "@repo/internationalization/src/routing";
import type { Locale } from "next-intl";
import {
  BASE_URL,
  type LlmsSection,
  SECTION_LABELS,
} from "@/lib/llms/constants";
import { formatSegmentTitle, getLocaleLabel } from "@/lib/llms/format";
import {
  LLMS_FULL_MANIFEST_PATH,
  LLMS_FULL_TEXT_PATH,
} from "@/lib/llms/full/constants";
import type {
  LlmsFullDocument,
  LlmsFullShard,
  LlmsFullTextArtifact,
} from "@/lib/llms/full/types";

/** Builds the compact full-corpus entrypoint for agent retrieval. */
export function buildRootFullText({
  documents,
  localeShards,
}: {
  documents: LlmsFullDocument[];
  localeShards: LlmsFullShard[];
}) {
  const shards = flattenShards(localeShards);
  const oversizedShards = shards.filter((shard) => shard.oversized);
  const lines = [
    "# Nakafa Full Documentation",
    "",
    "> Compact sitemap-derived Nakafa full-corpus map for AI agents. Use shard files for complete untruncated markdown content, page-level .md URLs for focused retrieval, and llms.txt for navigation.",
    "",
    `Source index: ${BASE_URL}/llms.txt`,
    `Shard manifest: ${BASE_URL}/${LLMS_FULL_MANIFEST_PATH}`,
    `Sitemap: ${BASE_URL}/sitemap.xml`,
    "",
    "## How To Use",
    "",
    "- Fetch one page with its `.md` URL when the task is focused.",
    "- Fetch a shard when the task needs a locale, section, topic, set, or Quran scope.",
    "- Fetch the manifest for machine-readable shard discovery.",
    "- Avoid HTML unless markdown is unavailable.",
    "",
    "## Corpus Summary",
    "",
    `- Locales: ${routing.locales.map(getLocaleLabel).join(", ")}`,
    `- Documents: ${documents.length}`,
    `- Source bytes: ${getDocumentsBytes(documents)}`,
    `- Shards: ${shards.length}`,
    "",
    "## Top-Level Shards",
    "",
    ...localeShards.map(formatShardLine),
    "",
    "## Manifest",
    "",
    `- [Machine-readable shard manifest](${BASE_URL}/${LLMS_FULL_MANIFEST_PATH}): all generated shard paths, byte counts, document counts, and oversized markers.`,
  ];

  if (oversizedShards.length > 0) {
    lines.push("", "## Oversized Shards", "");
    lines.push(...oversizedShards.map(formatShardLine));
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

/** Builds one shard node and recursively splits oversized scopes by segments. */
export function buildShard({
  documents,
  locale,
  prefixParts,
  shardTargetBytes,
}: {
  documents: LlmsFullDocument[];
  locale: Locale;
  prefixParts: string[];
  shardTargetBytes: number;
}): LlmsFullShard {
  const childGroups = getChildGroups(documents, prefixParts);
  const sourceBytes = getDocumentsBytes(documents);
  const shouldSplit = sourceBytes > shardTargetBytes && childGroups.length > 0;
  const children = shouldSplit
    ? childGroups.map(([segment, childDocuments]) =>
        buildShard({
          documents: childDocuments,
          locale,
          prefixParts: [...prefixParts, segment],
          shardTargetBytes,
        })
      )
    : [];
  const directDocuments = shouldSplit
    ? documents.filter(
        (document) => document.segments.length === prefixParts.length
      )
    : [];
  const scopeLabel = getShardScopeLabel({ documents, locale, prefixParts });
  const title = getShardTitle(scopeLabel);
  const text =
    children.length > 0
      ? renderShardIndexText({
          children,
          directDocuments,
          documentCount: documents.length,
          scopeLabel,
          sourceBytes,
          title,
        })
      : renderShardContentText({
          documents,
          scopeLabel,
          title,
        });
  const bytes = getTextBytes(text);

  return {
    bytes,
    children,
    documentCount: documents.length,
    href: `${BASE_URL}/${getShardPath(locale, prefixParts)}`,
    locale,
    oversized: bytes > shardTargetBytes,
    path: getShardPath(locale, prefixParts),
    prefixParts,
    section: getShardSection({ documents, prefixParts }),
    sourceBytes,
    text,
    title,
  };
}

/** Flattens a recursive shard tree into writeable text artifacts. */
export function flattenShards(shards: LlmsFullShard[]): LlmsFullShard[] {
  return shards.flatMap((shard) => [shard, ...flattenShards(shard.children)]);
}

/** Builds the machine-readable shard manifest served from public static files. */
export function buildFullManifest({
  documents,
  root,
  shards,
}: {
  documents: LlmsFullDocument[];
  root: LlmsFullTextArtifact;
  shards: LlmsFullShard[];
}) {
  const flattenedShards = flattenShards(shards);
  const oversizedShards = flattenedShards.filter((shard) => shard.oversized);

  return {
    entrypoint: `${BASE_URL}/${root.path}`,
    llms: `${BASE_URL}/llms.txt`,
    manifest: `${BASE_URL}/${LLMS_FULL_MANIFEST_PATH}`,
    sitemap: `${BASE_URL}/sitemap.xml`,
    totals: {
      documents: documents.length,
      entrypointBytes: root.bytes,
      sourceBytes: getDocumentsBytes(documents),
    },
    shards: flattenedShards.map(formatManifestShard),
    oversized: oversizedShards.map(formatManifestShard),
  };
}

/** Builds one generated text artifact with byte metadata. */
export function buildTextArtifact(
  path: string,
  text: string
): LlmsFullTextArtifact {
  return {
    bytes: getTextBytes(text),
    path,
    text,
  };
}

/** Renders a shard that contains child shard links instead of repeated content. */
function renderShardIndexText({
  children,
  directDocuments,
  documentCount,
  scopeLabel,
  sourceBytes,
  title,
}: {
  children: LlmsFullShard[];
  directDocuments: LlmsFullDocument[];
  documentCount: number;
  scopeLabel: string;
  sourceBytes: number;
  title: string;
}) {
  const lines = [
    `# ${title}`,
    "",
    `> Shard index for ${scopeLabel}. Open the child shard files for complete markdown content without downloading the whole corpus.`,
    "",
    `Source index: ${BASE_URL}/llms.txt`,
    `Full corpus entrypoint: ${BASE_URL}/${LLMS_FULL_TEXT_PATH}`,
    `Shard manifest: ${BASE_URL}/${LLMS_FULL_MANIFEST_PATH}`,
    `Documents covered: ${documentCount}`,
    `Source bytes covered: ${sourceBytes}`,
    "",
    "## Shards",
    "",
    ...children.map(formatShardLine),
    "",
  ];

  if (directDocuments.length > 0) {
    lines.push("## Direct Documents", "");
    lines.push(renderDocuments(directDocuments));
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

/** Renders a shard that contains complete markdown for its current scope. */
function renderShardContentText({
  documents,
  scopeLabel,
  title,
}: {
  documents: LlmsFullDocument[];
  scopeLabel: string;
  title: string;
}) {
  return [
    `# ${title}`,
    "",
    `> Complete markdown content for ${scopeLabel}.`,
    "",
    `Source index: ${BASE_URL}/llms.txt`,
    `Full corpus entrypoint: ${BASE_URL}/${LLMS_FULL_TEXT_PATH}`,
    `Shard manifest: ${BASE_URL}/${LLMS_FULL_MANIFEST_PATH}`,
    `Documents: ${documents.length}`,
    `Source bytes: ${getDocumentsBytes(documents)}`,
    "",
    "## Documents",
    "",
    renderDocuments(documents),
  ]
    .join("\n")
    .trimEnd()
    .concat("\n");
}

/** Renders complete page documents with separators between entries. */
function renderDocuments(documents: LlmsFullDocument[]) {
  return documents
    .flatMap((document) => [document.text, "", "---", ""])
    .join("\n")
    .trimEnd();
}

/** Groups documents by the next route segment below the current shard prefix. */
function getChildGroups(documents: LlmsFullDocument[], prefixParts: string[]) {
  const groups = new Map<string, LlmsFullDocument[]>();

  for (const document of documents) {
    const childSegment = document.segments[prefixParts.length];

    if (!childSegment) {
      continue;
    }

    const group = groups.get(childSegment) ?? [];
    group.push(document);
    groups.set(childSegment, group);
  }

  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

/** Builds one JSON-safe manifest entry from a generated shard. */
function formatManifestShard(shard: LlmsFullShard) {
  return {
    bytes: shard.bytes,
    children: shard.children.map((child) => child.path),
    documentCount: shard.documentCount,
    href: shard.href,
    locale: shard.locale,
    oversized: shard.oversized,
    path: shard.path,
    section: shard.section,
    sourceBytes: shard.sourceBytes,
    title: shard.title,
  };
}

/** Formats one shard link for root and parent shard maps. */
function formatShardLine(shard: LlmsFullShard) {
  const childNote =
    shard.children.length > 0 ? " Open child shards for content." : "";

  return `- [${shard.title}](${shard.href}): ${shard.documentCount} documents, ${shard.sourceBytes} source bytes.${childNote}`;
}

/** Builds the public path for one shard from locale and route prefix. */
function getShardPath(locale: Locale, prefixParts: string[]) {
  if (prefixParts.length === 0) {
    return `llms-full/${locale}.txt`;
  }

  return `llms-full/${locale}/${prefixParts.join("/")}.txt`;
}

/** Builds the display title for one shard scope. */
function getShardTitle(scopeLabel: string) {
  return `Nakafa ${scopeLabel} Full Documentation`;
}

/** Builds the human-readable scope label for one shard. */
function getShardScopeLabel({
  documents,
  locale,
  prefixParts,
}: {
  documents: LlmsFullDocument[];
  locale: Locale;
  prefixParts: string[];
}) {
  const localeLabel = getLocaleLabel(locale);

  if (prefixParts.length === 0) {
    return localeLabel;
  }

  const [, ...segments] = prefixParts;
  const sectionLabel = SECTION_LABELS[documents[0].section];
  const segmentLabel = segments.map(formatSegmentTitle).join(" / ");

  if (!segmentLabel) {
    return `${localeLabel} ${sectionLabel}`;
  }

  return `${localeLabel} ${sectionLabel}: ${segmentLabel}`;
}

/** Resolves the content section represented by one shard prefix. */
function getShardSection({
  documents,
  prefixParts,
}: {
  documents: LlmsFullDocument[];
  prefixParts: string[];
}): LlmsSection | undefined {
  if (prefixParts.length === 0) {
    return;
  }

  return documents[0].section;
}

/** Sums the source text bytes represented by a set of documents. */
function getDocumentsBytes(documents: LlmsFullDocument[]) {
  return documents.reduce((total, document) => total + document.bytes, 0);
}

/** Counts UTF-8 bytes for generated agent text files. */
function getTextBytes(text: string) {
  return Buffer.byteLength(text, "utf8");
}

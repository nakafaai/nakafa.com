import { buildContentSearchExcerpt } from "@repo/backend/confect/contents/search/excerpt";
import {
  EMBED_TEXT_CHARS,
  SECTION_TEXT_CHARS,
} from "@repo/backend/confect/contents/sections/limits";
import type { SectionFields } from "@repo/backend/confect/contents/sections/schema";
import {
  type DocumentSection,
  splitSections,
} from "@repo/backend/confect/contents/sections/split";
import { embeddingModelId } from "@repo/backend/confect/gateway/model";
import { Array as Arr, String as Str } from "effect";

const LEADING_HEADING = /^#{1,6}[^\n]*(?:\n|$)/;
const PATH_SEPARATOR = " > ";
const LONE_SURROGATE = /[\uD800-\uDFFF]/gu;

/**
 * The shape of a section as `sectionOf` and `documentSections` make it. Raise
 * it when the way a document is split into sections or a section's text is
 * made changes, so that the next build makes the sections of every document
 * again instead of trusting the version it stored for them.
 */
const SECTION_FORMAT = "1";

/**
 * Names what the sections of a document are made from: the section format, the
 * model that embeds them, and the signed facts of the source, such as the
 * hashes of its projection and its artifact. The same facts always give the
 * same name.
 */
export function sourceVersion(...facts: readonly string[]) {
  return Arr.join([SECTION_FORMAT, embeddingModelId, ...facts], ":");
}

/**
 * Drops the halves of characters from a text. A character outside the basic
 * plane takes two places, and a cut that falls between them leaves half of it,
 * which no stored string or request may hold. The units of a pair that stays
 * whole are not halves.
 */
function wellFormed(text: string) {
  return Str.replace(LONE_SURROGATE, "")(text);
}

/** Cuts a text to at most `chars` places, without the half of a character that the cut may leave. */
function cut(text: string, chars: number) {
  return wellFormed(Str.slice(0, chars)(text));
}

/** The text of a section without its own heading line, which the heading path already names. */
function sectionBody(part: DocumentSection) {
  return Str.trim(Str.replace(LEADING_HEADING, "")(part.text));
}

/**
 * Completes a section with the text it is found by, both by words and by
 * meaning: the title of its document, the headings that lead to it, and its
 * body, cut to the length that word search keeps, and with a short excerpt.
 */
export function sectionOf(
  fields: Omit<SectionFields, "excerpt" | "text">,
  title: string,
  body: string
): SectionFields {
  return {
    ...fields,
    excerpt: wellFormed(
      buildContentSearchExcerpt({ description: "", text: body }, [])
    ),
    text: cut(
      Arr.join(
        Arr.filter(
          [title, Arr.join(fields.headingPath, PATH_SEPARATOR), body],
          Str.isNonEmpty
        ),
        "\n"
      ),
      SECTION_TEXT_CHARS
    ),
  };
}

/**
 * Splits one document into its sections, in the order a reader lists them.
 * `markdown` is the agent markdown of the document, which starts with its
 * title, and `source` says where the document lives. A heading with no text
 * under it makes no section, but still takes its place in the order, so the
 * same section has the same place in every language.
 */
export function documentSections(
  source: Pick<
    SectionFields,
    "appLocale" | "contentKey" | "publicPath" | "section"
  >,
  title: string,
  markdown: string
) {
  const parts = splitSections(markdown);
  return Arr.flatMap(parts, (part, ordinal) => {
    const body = sectionBody(part);
    if (body === "") {
      return [];
    }
    return [
      sectionOf(
        {
          ...source,
          anchor: part.slug,
          count: parts.length,
          headingPath: part.path,
          ordinal,
        },
        title,
        body
      ),
    ];
  });
}

/** The part of a section's text that is sent to the embedder. */
export function embedInput(text: string) {
  return cut(text, EMBED_TEXT_CHARS);
}

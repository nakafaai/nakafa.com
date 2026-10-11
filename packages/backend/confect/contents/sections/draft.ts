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
import { Array as Arr, String as Str } from "effect";

const LEADING_HEADING = /^#{1,6}[^\n]*(?:\n|$)/;
const PATH_SEPARATOR = " > ";

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
    excerpt: buildContentSearchExcerpt({ description: "", text: body }, []),
    text: Str.slice(
      0,
      SECTION_TEXT_CHARS
    )(
      Arr.join(
        Arr.filter(
          [title, Arr.join(fields.headingPath, PATH_SEPARATOR), body],
          Str.isNonEmpty
        ),
        "\n"
      )
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
  return Str.slice(0, EMBED_TEXT_CHARS)(text);
}

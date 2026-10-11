import { toAnchorSlug } from "@repo/utilities/slug";
import {
  Array as Arr,
  MutableHashMap,
  MutableList,
  Option,
  Schema,
} from "effect";

/** The implicit section before a document's first heading. */
export const READ_START_SECTION = "top";
const HEADING = /^(#{2,3})\s+(.+?)\s*#*$/;
const SECTION_LEVEL = 2;

/**
 * One heading section of a markdown document, keyed by a stable heading slug.
 * `path` holds the headings that lead to it, from the level-two heading to its
 * own, and is empty before the first heading.
 */
const DocumentSectionSchema = Schema.Struct({
  path: Schema.Array(Schema.String),
  slug: Schema.String,
  text: Schema.String,
  title: Schema.String,
});
export type DocumentSection = typeof DocumentSectionSchema.Type;

/**
 * Splits agent markdown at level-two and level-three headings. The reader of a
 * lesson and the index of its sections both use this split, so the slug of a
 * search hit opens the same section when it is read.
 */
export function splitSections(markdown: string) {
  const sections = MutableList.make<DocumentSection>();
  const counts = MutableHashMap.empty<string, number>();
  let title = "Start";
  let slug = READ_START_SECTION;
  let path: readonly string[] = [];
  let parent: string | undefined;
  const lines = MutableList.make<string>();
  /** Ends the open section, taking its lines. */
  const close = () => {
    const text = Arr.join(MutableList.takeAll(lines), "\n").trim();
    if (text) {
      MutableList.append(sections, { path, slug, text, title });
    }
  };
  for (const line of markdown.split("\n")) {
    const heading = HEADING.exec(line);
    if (!heading?.[2]) {
      MutableList.append(lines, line);
      continue;
    }
    close();
    title = heading[2];
    if (heading[1]?.length === SECTION_LEVEL) {
      parent = title;
      path = [title];
    } else {
      path = parent === undefined ? [title] : [parent, title];
    }
    const base = toAnchorSlug(title);
    const seen =
      Option.getOrElse(MutableHashMap.get(counts, base), () => 0) + 1;
    MutableHashMap.set(counts, base, seen);
    slug = seen === 1 ? base : `${base}-${seen}`;
    MutableList.append(lines, line);
  }
  close();
  return MutableList.takeAll(sections);
}

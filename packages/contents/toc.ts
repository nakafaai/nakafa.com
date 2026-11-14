import type {
  ContentTreeChild,
  ContentTreeElement,
} from "@nakafa/aksara-contracts/tree";
import { createHeadingId, createHeadingLabel } from "@repo/math/heading";
import { Array as Arr, Option, Predicate, Record as Rec, Schema } from "effect";

/** The heading tags of a content tree, each with the level it names. */
const HEADING_LEVELS: Record<string, number> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6,
};

/**
 * The words of one node as a reader sees them: its text, and the source of each
 * formula, which stands in a component's `math` prop instead of its children.
 */
function textOf(child: ContentTreeChild): string {
  if (Predicate.isString(child)) {
    return child;
  }
  const { math } = child.props;
  if (Predicate.isString(math)) {
    return math;
  }
  return Arr.join(Arr.map(child.children, textOf), "");
}

/**
 * The anchor of one heading of a content tree, or none for any other element:
 * the id its author gave, or the id of the words it shows. The renderer gives
 * each heading this id, and the outline links to it, so the two never differ.
 */
export function headingIdOf(
  element: ContentTreeElement
): Option.Option<string> {
  return Rec.get(HEADING_LEVELS, element.name).pipe(
    Option.map(() => {
      const { id } = element.props;
      return Predicate.isString(id) ? id : createHeadingId(textOf(element));
    })
  );
}

/** A heading in document order, before its children are nested under it. */
const HeadingEntrySchema = Schema.Struct({
  href: Schema.String,
  label: Schema.String,
  level: Schema.Finite,
});

type HeadingEntry = typeof HeadingEntrySchema.Type;

/** Every heading under one node, in the order the page draws them. */
function headingEntries(child: ContentTreeChild): HeadingEntry[] {
  if (Predicate.isString(child)) {
    return [];
  }
  return Option.match(
    Option.all({
      id: headingIdOf(child),
      level: Rec.get(HEADING_LEVELS, child.name),
    }),
    {
      onNone: () => Arr.flatMap(child.children, headingEntries),
      onSome: ({ id, level }) => [
        { href: `#${id}`, label: createHeadingLabel(textOf(child)), level },
      ],
    }
  );
}

/**
 * The outline of one signed content tree: each heading the page draws, with the
 * anchor the renderer gives it, nested under the nearest heading of a higher
 * level before it.
 */
export function contentOutline(tree: ContentTreeElement): ParsedHeading[] {
  return nestHeadings(headingEntries(tree));
}

/**
 * Nests each entry under the nearest earlier entry with a smaller level. An
 * entry with no such earlier entry starts a sibling run, and the entries after
 * it, up to the next run, are its descendants.
 */
function nestHeadings(entries: readonly HeadingEntry[]): ParsedHeading[] {
  const starts = siblingStarts(entries);
  const ends = Arr.append(Arr.drop(starts, 1), entries.length);
  return Arr.map(Arr.zip(starts, ends), ([start, end]) => {
    const entry = entries[start];
    return {
      label: entry.label,
      href: entry.href,
      children: nestHeadings(
        Arr.take(Arr.drop(entries, start + 1), end - start - 1)
      ),
    };
  });
}

/** Lists the indexes of the entries with no earlier entry of a smaller level. */
function siblingStarts(entries: readonly HeadingEntry[]) {
  // shallowestBefore[index] is the smallest level among the entries before it.
  const shallowestBefore = Arr.scan(
    entries,
    Number.POSITIVE_INFINITY,
    (shallowest, entry) => Math.min(shallowest, entry.level)
  );
  return Arr.filter(
    Arr.map(entries, (_entry, index) => index),
    (index) => entries[index].level <= shallowestBefore[index]
  );
}

export const ParsedHeadingSchema = Schema.Struct({
  children: Schema.Array(
    Schema.suspend((): Schema.Codec<ParsedHeading> => ParsedHeadingSchema)
  ).pipe(Schema.mutable),
  href: Schema.String,
  label: Schema.String,
});

type ParsedHeadingFields = typeof ParsedHeadingSchema.Type;

/**
 * One heading in the table of contents. The interface only names the recursive
 * shape; every field is derived from `ParsedHeadingSchema`. Its `href` is the
 * one source of the heading's id: the outline links to it and watches it.
 */
export interface ParsedHeading extends ParsedHeadingFields {}

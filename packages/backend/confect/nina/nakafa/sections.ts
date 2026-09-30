import {
  boundText,
  countTextTokens,
  NINA_BUDGET,
} from "@repo/backend/confect/nina/budget";
import type { NakafaAgentMarkdown } from "@repo/contents/agent/schema/read";
import { slugify } from "@repo/utilities/slug";

/** The implicit section before a document's first heading. */
const READ_START_SECTION = "top";
/** Most remaining sections listed in a read outline. */
const OUTLINE_LIMIT = 24;
const HEADING = /^#{2,3}\s+(.+?)\s*#*$/;

/** One readable markdown section, keyed by a stable heading slug. */
interface ReadSection {
  readonly slug: string;
  readonly text: string;
  readonly title: string;
}

/** Splits agent markdown at level-two and level-three headings. */
function splitSections(markdown: string) {
  const sections: ReadSection[] = [];
  const counts = new Map<string, number>();
  let title = "Start";
  let slug = READ_START_SECTION;
  let lines: string[] = [];
  const close = () => {
    const text = lines.join("\n").trim();
    if (text) {
      sections.push({ slug, text, title });
    }
  };
  for (const line of markdown.split("\n")) {
    const heading = HEADING.exec(line);
    if (!heading?.[1]) {
      lines.push(line);
      continue;
    }
    close();
    title = heading[1];
    const base = slugify(title);
    const seen = (counts.get(base) ?? 0) + 1;
    counts.set(base, seen);
    slug = seen === 1 ? base : `${base}-${seen}`;
    lines = [line];
  }
  close();
  return sections;
}

/**
 * Returns the longest head of `line` within `limit` tokens, ending after a
 * space when one keeps at least half of it. Cutting by characters, not tokens,
 * never splits a multibyte character.
 */
function headWithin(line: string, limit: number) {
  let low = 0;
  let high = line.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (countTextTokens(line.slice(0, middle)) <= limit) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  const space = line.lastIndexOf(" ", low - 1);
  return line.slice(0, space >= low / 2 ? space + 1 : low);
}

/**
 * Splits a section longer than `limit` tokens into parts at line boundaries,
 * and a longer line at a word boundary. Later parts get their own slug, so a
 * read can continue inside a long section.
 */
function splitParts(section: ReadSection, limit: number): ReadSection[] {
  if (countTextTokens(section.text) <= limit) {
    return [section];
  }
  const parts: string[] = [];
  let lines: string[] = [];
  let used = 0;
  const close = () => {
    parts.push(lines.join("\n"));
    lines = [];
    used = 0;
  };
  for (const line of section.text.split("\n")) {
    let rest = line;
    // Each line also costs its line break.
    while (used + countTextTokens(rest) + 1 > limit) {
      const room = limit - used - 1;
      if (countTextTokens(rest) + 1 <= limit || room < limit / 4) {
        // The line fits a new part, or too little room is left to split it.
        close();
        continue;
      }
      const head = headWithin(rest, room);
      lines.push(head);
      close();
      rest = rest.slice(head.length);
    }
    lines.push(rest);
    used += countTextTokens(rest) + 1;
  }
  close();
  return parts.map((text, index) =>
    index === 0
      ? { ...section, text }
      : {
          slug: `${section.slug}:part-${index + 1}`,
          text,
          title: `${section.title} (part ${index + 1})`,
        }
  );
}

/** Names one section the model can request. */
function formatEntry({ slug, title }: ReadSection) {
  return `- ${title} (section: ${slug})`;
}

/** Lists sections the model can request next, capped for long documents. */
function formatOutline(sections: readonly ReadSection[]) {
  if (sections.length === 0) {
    return "";
  }
  const listed = sections.slice(0, OUTLINE_LIMIT).map(formatEntry);
  const more = sections.length - listed.length;
  return [
    "## Other Sections",
    ...listed,
    ...(more > 0 ? [`- ${more} more sections`] : []),
  ].join("\n");
}

/**
 * Returns the most tokens an outline of any of these sections can take: its
 * heading, the longest entries it can list, the omitted count, and the breaks
 * that join it to the read.
 */
function outlineReserve(sections: readonly ReadSection[]) {
  const entries = sections
    .map((section) => countTextTokens(formatEntry(section)) + 1)
    .sort((first, second) => second - first)
    .slice(0, OUTLINE_LIMIT);
  const frame = countTextTokens(
    `\n\n## Other Sections\n- ${sections.length} more sections\n\n`
  );
  return entries.reduce((total, cost) => total + cost, frame);
}

/**
 * Formats a Nakafa content read within a token budget. Reading starts at
 * `section` when given, then continues through the sections that fit, and the
 * outline names the rest, the following sections first, so the model can read
 * them next.
 */
export function formatRead(
  result: NakafaAgentMarkdown,
  {
    budget = NINA_BUDGET.evidence,
    section,
  }: {
    readonly budget?: number;
    readonly section?: string | undefined;
  } = {}
) {
  const description = result.description
    ? `\n- Description: ${result.description}`
    : "";
  const header = `# Nakafa Content\n- Title: ${result.title}${description}\n- Content ID: ${result.content_id}`;
  // Half the budget per part leaves room for the header and the outline.
  const parts = splitSections(result.text).flatMap((candidate) =>
    splitParts(candidate, Math.floor(budget / 2))
  );
  const start = parts.findIndex(
    ({ slug }) => slug === (section ?? READ_START_SECTION)
  );
  if (section !== undefined && start < 0) {
    return boundText(
      [
        header,
        `Section ${section} was not found in this content.`,
        formatOutline(parts),
      ].join("\n\n"),
      budget,
      "Request one of the listed sections."
    );
  }
  const bodyBudget = budget - countTextTokens(header) - outlineReserve(parts);
  const from = Math.max(start, 0);
  const included: ReadSection[] = [];
  let used = 0;
  for (const candidate of parts.slice(from)) {
    const cost = countTextTokens(candidate.text);
    if (included.length > 0 && used + cost > bodyBudget) {
      break;
    }
    included.push(candidate);
    used += cost;
  }
  const end = from + included.length;
  // A long description or outline can leave no room for a part; the read
  // still never exceeds its budget.
  return boundText(
    [
      header,
      included.map(({ text }) => text).join("\n\n"),
      formatOutline([...parts.slice(end), ...parts.slice(0, from)]),
    ]
      .filter(Boolean)
      .join("\n\n"),
    budget,
    "Request one of the listed sections."
  );
}

import type {
  InlineNode,
  Mark,
} from "@nakafa/aksara-contracts/assessment/inline";
import { MarkSchema } from "@nakafa/aksara-contracts/assessment/inline";
import { Array as Arr, Match, MutableList, Order, Schema } from "effect";

/**
 * Canonical nesting priority of inline marks, outermost first.
 *
 * `highlight` and `bold` stay outside `link` so links inside a marked phrase inherit the surface's
 * foreground contrast (`emphasisVariants`), and `code` stays innermost on its own muted chip.
 */
const MARK_PRIORITY: Record<Mark["type"], number> = {
  bold: 1,
  code: 7,
  highlight: 0,
  italic: 3,
  link: 2,
  subscript: 5,
  superscript: 6,
  underline: 4,
};

/** Canonical key of one mark: two marks with the same key render the exact same wrapper. */
function markKey(mark: Mark): string {
  return Match.value(mark).pipe(
    Match.discriminatorsExhaustive("type")({
      bold: () => "bold",
      code: () => "code",
      highlight: ({ attrs }) => `highlight:${attrs.variant ?? ""}`,
      italic: () => "italic",
      link: ({ attrs }) => `link:${attrs.href}`,
      subscript: () => "subscript",
      superscript: () => "superscript",
      underline: () => "underline",
    })
  );
}

/** Orders marks canonically so adjacent nodes with the same marks share one wrapper. */
const CanonicalMarkOrder: Order.Order<Mark> = Order.combine(
  Order.mapInput(Order.Number, (mark) => MARK_PRIORITY[mark.type]),
  Order.mapInput(Order.String, markKey)
);

/** One leaf inline node after its surrounding marks have been lifted into outer runs. */
const InlineLeafSchema = Schema.Union([
  Schema.Struct({ type: Schema.Literal("hardBreak") }),
  Schema.Struct({
    interaction: Schema.String,
    type: Schema.Literal("inlineInteraction"),
  }),
  Schema.Struct({
    latex: Schema.String,
    type: Schema.Literal("mathInline"),
  }),
  Schema.Struct({
    text: Schema.String,
    type: Schema.Literal("text"),
  }),
]);

export type InlineLeaf = typeof InlineLeafSchema.Type;

export type InlineRun =
  | { readonly kind: "leaf"; readonly node: InlineLeaf }
  | {
      readonly children: readonly InlineRun[];
      readonly kind: "mark";
      readonly mark: Mark;
    };

/** One grouped inline run: either a leaf node or a shared mark wrapping contiguous child runs. */
export const InlineRunSchema: Schema.Codec<InlineRun> = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("leaf"), node: InlineLeafSchema }),
  Schema.Struct({
    children: Schema.Array(
      Schema.suspend((): Schema.Codec<InlineRun> => InlineRunSchema)
    ),
    kind: Schema.Literal("mark"),
    mark: MarkSchema,
  }),
]);

const MarkedItemSchema = Schema.Struct({
  leaf: InlineLeafSchema,
  marks: Schema.Array(MarkSchema),
});

type MarkedItem = typeof MarkedItemSchema.Type;

function normalizeMarks(marks: readonly Mark[] | undefined): readonly Mark[] {
  if (marks === undefined) {
    return [];
  }
  return Arr.sort(marks, CanonicalMarkOrder);
}

function toMarkedItem(node: InlineNode): MarkedItem {
  return Match.value(node).pipe(
    Match.discriminatorsExhaustive("type")({
      hardBreak: () => ({ leaf: { type: "hardBreak" as const }, marks: [] }),
      inlineInteraction: ({ attrs }) => ({
        leaf: {
          interaction: attrs.interaction,
          type: "inlineInteraction" as const,
        },
        marks: [],
      }),
      mathInline: ({ attrs, marks }) => ({
        leaf: { latex: attrs.latex, type: "mathInline" as const },
        marks: normalizeMarks(marks),
      }),
      text: ({ marks, text }) => ({
        leaf: { text, type: "text" as const },
        marks: normalizeMarks(marks),
      }),
    })
  );
}

function groupMarked(items: readonly MarkedItem[]): readonly InlineRun[] {
  const runs = MutableList.make<InlineRun>();
  let remaining = items;

  while (Arr.isReadonlyArrayNonEmpty(remaining)) {
    const [head] = remaining;
    const [outer] = head.marks;
    if (outer === undefined) {
      MutableList.append(runs, { kind: "leaf", node: head.leaf });
      remaining = Arr.drop(remaining, 1);
      continue;
    }
    const outerKey = markKey(outer);
    const [matching, rest] = Arr.span(
      remaining,
      (item) =>
        item.marks[0] !== undefined && markKey(item.marks[0]) === outerKey
    );
    const unwrapped = Arr.map(matching, ({ leaf, marks }) => ({
      leaf,
      marks: Arr.drop(marks, 1),
    }));
    MutableList.append(runs, {
      children: groupMarked(unwrapped),
      kind: "mark",
      mark: outer,
    });
    remaining = rest;
  }

  return MutableList.toArray(runs);
}

/**
 * Groups contiguous inline nodes (`text` and `mathInline`) that share canonical outer marks into one
 * tree of runs, so a highlighted phrase like `**koefisien di depan $x$**` renders inside one continuous
 * emphasis pill instead of breaking before the inline formula.
 */
export function groupInlineNodes(
  nodes: readonly InlineNode[] | undefined
): readonly InlineRun[] {
  return groupMarked(Arr.map(nodes ?? [], toMarkedItem));
}

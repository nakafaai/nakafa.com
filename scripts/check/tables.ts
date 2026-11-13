import { Array as Arr, Equal, HashSet, Option, Result, Schema } from "effect";
import {
  isBinaryExpression,
  isConditionalExpression,
  isIdentifier,
  isJsxExpression,
  isParenthesizedExpression,
  type Node,
  SyntaxKind,
} from "tsrs/ast";
import {
  type Component,
  componentGraph,
  componentKey,
} from "#scripts/check/components";
import { nodesBelow } from "#scripts/check/drilling";
import { opening } from "#scripts/check/jsx";
import { place } from "#scripts/check/places";
import { children } from "#scripts/check/source";

const TABLE_TAG = "DataTable";
const CHILDREN = "children";
/** The operators whose value is one of their sides: `&&` gives its right side, `||` and `??` either side. */
const CHOICE_OPERATORS = HashSet.make(
  SyntaxKind.AmpersandAmpersandToken,
  SyntaxKind.BarBarToken,
  SyntaxKind.QuestionQuestionToken
);
/** The one card a list stands in, and the bodies that draw it: a page's list and a pane's or a sheet's. */
const CARD_TAGS = HashSet.make("ListCard", "PageList", "PaneFill");

/** What the graph knows so far: the components that put their children in a card, and those that draw a loose table. */
const Reading = Schema.Struct({
  cards: Schema.HashSet(Schema.String),
  loose: Schema.HashSet(Schema.String),
});
type Reading = typeof Reading.Type;

/** What one component holds: whether it places its children in a card, and the tables it draws outside one. */
interface Found {
  readonly carded: boolean;
  readonly tables: readonly Node[];
}

const NOTHING_FOUND: Found = { carded: false, tables: [] };

/**
 * Whether an expression places a component's `children` as they are: `{children}`, or one branch of a condition or of
 * `&&`, `||` and `??` that does, such as `{shown === "requests" ? requests : children}`.
 */
function placesChildren(node: Node): boolean {
  if (isIdentifier(node)) {
    return node.text === CHILDREN;
  }
  if (isJsxExpression(node) || isParenthesizedExpression(node)) {
    return node.expression !== undefined && placesChildren(node.expression);
  }
  if (isConditionalExpression(node)) {
    return placesChildren(node.whenTrue) || placesChildren(node.whenFalse);
  }
  return (
    isBinaryExpression(node) &&
    HashSet.has(CHOICE_OPERATORS, node.operatorToken.kind) &&
    (placesChildren(node.right) ||
      (node.operatorToken.kind !== SyntaxKind.AmpersandAmpersandToken &&
        placesChildren(node.left)))
  );
}

/** The parts of one component that a reading judges, through the component each element names. */
function parts(
  component: Component,
  resolve: (file: string, tag: string) => Option.Option<Component>,
  known: Reading
) {
  const named = (node: Node, set: HashSet.HashSet<string>) =>
    Option.exists(
      Option.flatMap(opening(node), ({ tag }) =>
        tag === undefined ? Option.none() : resolve(component.file, tag)
      ),
      (target) => HashSet.has(set, componentKey(target))
    );
  const isCard = (node: Node) =>
    Option.exists(
      opening(node),
      ({ tag }) => tag !== undefined && HashSet.has(CARD_TAGS, tag)
    ) || named(node, known.cards);
  /** The loose tables below a node, and whether it places its children in a card. */
  const below = (node: Node, inCard: boolean): Found =>
    Arr.reduce(children(node), NOTHING_FOUND, (found, child): Found => {
      const card = inCard || isCard(child);
      const placed = card && placesChildren(child);
      const table =
        !card &&
        (Option.exists(opening(child), ({ tag }) => tag === TABLE_TAG) ||
          named(child, known.loose));
      const deeper = below(child, card);
      return {
        carded: found.carded || placed || deeper.carded,
        tables: Arr.flatten([
          found.tables,
          table ? [child] : [],
          deeper.tables,
        ]),
      };
    });
  return below(component.body, false);
}

/** Reads every component again until the cards and the loose tables stop changing. */
function settle(
  components: readonly Component[],
  resolve: (file: string, tag: string) => Option.Option<Component>,
  known: Reading
): Reading {
  const read = Arr.map(components, (component) => ({
    component,
    found: parts(component, resolve, known),
  }));
  const next = {
    cards: HashSet.fromIterable(
      Arr.filterMap(read, ({ component, found }) =>
        found.carded ? Result.succeed(componentKey(component)) : Result.failVoid
      )
    ),
    loose: HashSet.fromIterable(
      Arr.filterMap(read, ({ component, found }) =>
        Arr.isReadonlyArrayNonEmpty(found.tables)
          ? Result.succeed(componentKey(component))
          : Result.failVoid
      )
    ),
  };
  // The cards only grow, and once they settle the loose tables only grow, so the reading settles.
  return Equal.equals(next.cards, known.cards) &&
    Equal.equals(next.loose, known.loose)
    ? next
    : settle(components, resolve, next);
}

/**
 * Reports a table that no page puts in a list card. A list of records is the whole body of its page or of its pane, in
 * the one card (`ListCard`) that fills the height it is given and scrolls inside, so a table never stands in a form, a
 * section or a dialog of its own. A `DataTable` stands in `PageList`, `PaneFill` or `ListCard`, written around it or
 * around the component that draws it, through every component that places its children in one of them. The check
 * reads the components that draw a loose table up to the ones no element renders, such as a route's page, and reports
 * the table where the chain starts.
 */
export function inspectTables(modules: Parameters<typeof componentGraph>[0]) {
  const { components, resolve } = componentGraph(modules);
  const known = settle(components, resolve, {
    cards: HashSet.empty(),
    loose: HashSet.empty(),
  });
  const rendered = HashSet.fromIterable(
    Arr.flatMap(components, (component) =>
      Arr.flatMap(nodesBelow(component.body), (node) =>
        Option.toArray(
          Option.map(
            Option.flatMap(opening(node), ({ tag }) =>
              tag === undefined ? Option.none() : resolve(component.file, tag)
            ),
            componentKey
          )
        )
      )
    )
  );
  return Arr.flatMap(components, (component) =>
    HashSet.has(known.loose, componentKey(component)) &&
    !HashSet.has(rendered, componentKey(component))
      ? Arr.map(
          parts(component, resolve, known).tables,
          (table) =>
            `${place(component.file, component.sourceFile, table)}: a DataTable stands outside a list card. A table is the whole body of its page or pane: draw it, or the component that draws it, in PageList, PaneFill or ListCard.`
        )
      : []
  );
}

import {
  Array as Arr,
  Equal,
  HashMap,
  HashSet,
  Number as Num,
  Option,
  Result,
  Schema,
} from "effect";
import {
  isBinaryExpression,
  isConditionalExpression,
  isIdentifier,
  isJsxAttribute,
  isJsxElement,
  isJsxExpression,
  isJsxFragment,
  isObjectLiteralExpression,
  isParenthesizedExpression,
  isPropertyAssignment,
  isStringLiteralLikeNode,
  type JsxAttributes,
  type Node,
  SyntaxKind,
} from "tsrs/ast";
import {
  type Component,
  componentGraph,
  componentKey,
  rootsOf,
} from "#scripts/check/components";
import { nodesBelow } from "#scripts/check/drilling";
import { attributeValue, opening } from "#scripts/check/jsx";
import { place } from "#scripts/check/places";

/** The one slot of a page header's actions, which the page frame owns. */
const ACTIONS_TAG = "PageActions";
const ACTIONS_MODULE = "apps/www/src/components/shared/page/header.tsx";
const CHILDREN = "children";
/** The prop a header names for its search field, which filters the page and is no action of its own. */
const SEARCH_SLOT = "search";
const GROUP_TAG = "ButtonGroup";
/**
 * What stands in a header's row without being one of its actions: a search field, which filters the page, and a popup
 * or a dialog that a control opens, whose content is elsewhere.
 */
const QUIET_TAG_PATTERN = /Search$|(?:Content|Popup|Dialog|Sheet|Drawer)$/u;
/**
 * A header's row shows at most two standalone pills, and its secondary icon actions, such as More or the outline
 * toggle, stand in its one group: an icon button standing beside the group or beside another icon button joins it.
 */
const MOST_PILLS = 2;
const MOST_ICON_PARTS = 1;
/** The size of a button that shows an icon alone, such as `size="icon-sm"`. */
const ICON_SIZE_PATTERN = /^icon/u;
const SIZE_ATTRIBUTE = "size";

/** What stands alone in a header's row: its pill buttons, its icon buttons, and its button groups. */
const Row = Schema.Struct({
  groups: Schema.Finite,
  icons: Schema.Finite,
  pills: Schema.Finite,
});
type Row = typeof Row.Type;

const EMPTY_ROW: Row = { groups: 0, icons: 0, pills: 0 };
const GROUP_ROW: Row = { groups: 1, icons: 0, pills: 0 };
const ICON_ROW: Row = { groups: 0, icons: 1, pills: 0 };
const PILL_ROW: Row = { groups: 0, icons: 0, pills: 1 };

/** Two parts of one row, side by side. */
function beside(one: Row, other: Row): Row {
  return {
    groups: one.groups + other.groups,
    icons: one.icons + other.icons,
    pills: one.pills + other.pills,
  };
}

/** The larger of two rows, of which only one renders, such as the two branches of a condition. */
function either(one: Row, other: Row): Row {
  return {
    groups: Num.max(one.groups, other.groups),
    icons: Num.max(one.icons, other.icons),
    pills: Num.max(one.pills, other.pills),
  };
}

/** What a row holds beyond a header's limit, as the sentence of its finding, or none. */
function crowding(row: Row) {
  if (row.pills > MOST_PILLS) {
    return Option.some(
      `a page header shows ${row.pills} standalone pills. A header shows at most two: put the other actions in its one ButtonGroup.`
    );
  }
  return row.icons + row.groups > MOST_ICON_PARTS
    ? Option.some(
        `a page header shows ${row.icons} icon buttons and ${row.groups} button groups apart. Its secondary icon actions, such as More or the outline toggle, stand in one ButtonGroup.`
      )
    : Option.none();
}

/** A header component: the row it draws itself, and the props it places in that row as they are, at least one. */
const Header = Schema.Struct({
  forwards: Schema.HashSet(Schema.String),
  own: Row,
});
type Header = typeof Header.Type;

/** What a part of a header's row holds: its row, and the names it places there as they are. */
const Reading = Schema.Struct({
  names: Schema.HashSet(Schema.String),
  row: Row,
});
type Reading = typeof Reading.Type;

const EMPTY_READING: Reading = { names: HashSet.empty(), row: EMPTY_ROW };

/** Two readings side by side. */
function joined(one: Reading, other: Reading): Reading {
  return {
    names: HashSet.union(one.names, other.names),
    row: beside(one.row, other.row),
  };
}

/** The headers that the graph knows so far, by the place of each component. */
type Headers = HashMap.HashMap<string, Header>;
/** At most this many readings settle the graph: each one follows a header one component further. */
const MOST_ROUNDS = 12;

/** How a row's reading tells the header, the group and the icon button that an element names. */
interface Reader {
  readonly headerOf: (element: Node) => Option.Option<Header>;
  readonly isGroup: (element: Node) => boolean;
  readonly isIcon: (element: Node) => boolean;
}

/** The components that draw a group at their root, and those whose controls all show an icon alone, by place. */
const Kinds = Schema.Struct({
  groups: Schema.HashSet(Schema.String),
  icons: Schema.HashSet(Schema.String),
});
type Kinds = typeof Kinds.Type;

/** The value that a `size` attribute or a `size` member writes, or none for any other node. */
function sizeValue(node: Node): Option.Option<Node> {
  if (isJsxAttribute(node)) {
    return isIdentifier(node.name) &&
      node.name.text === SIZE_ATTRIBUTE &&
      node.initializer !== undefined
      ? Option.some(node.initializer)
      : Option.none();
  }
  return isPropertyAssignment(node) &&
    isIdentifier(node.name) &&
    node.name.text === SIZE_ATTRIBUTE
    ? Option.some(node.initializer)
    : Option.none();
}

/**
 * Whether what a node holds shows an icon alone: it writes a size, as `size="icon"`, a `render` that does, or
 * `buttonVariants({ size: "icon-sm" })`, and every size it writes is an icon size.
 */
function iconSized(node: Node) {
  const sizes = Arr.flatMap(Arr.prepend(nodesBelow(node), node), (below) =>
    Option.toArray(sizeValue(below))
  );
  return (
    Arr.isReadonlyArrayNonEmpty(sizes) &&
    Arr.every(
      sizes,
      (size) =>
        isStringLiteralLikeNode(size) && ICON_SIZE_PATTERN.test(size.text)
    )
  );
}

/** Whether an element shows an icon alone, by what its own attributes write. */
function drawsIcon(element: Node) {
  return Option.exists(opening(element), ({ attributes }) =>
    iconSized(attributes)
  );
}

/** What a usage of a header writes into the props the header places in its row, its search field left out. */
function slotContents(
  element: Node,
  attributes: JsxAttributes,
  forwards: HashSet.HashSet<string>
) {
  const composed = isJsxElement(element) ? element.children : [];
  const placed = HashSet.remove(forwards, SEARCH_SLOT);
  const written = Arr.flatMap(Arr.fromIterable(placed), (name) =>
    name === CHILDREN
      ? composed
      : Option.toArray(attributeValue(attributes, name))
  );
  const members = Arr.flatMap(attributes.properties, (property) =>
    Arr.flatMap(nodesBelow(property), (value) =>
      isObjectLiteralExpression(value)
        ? Arr.filterMap(value.properties, (member) =>
            isPropertyAssignment(member) &&
            isIdentifier(member.name) &&
            HashSet.has(placed, member.name.text)
              ? Result.succeed<Node>(member.initializer)
              : Result.failVoid
          )
        : []
    )
  );
  return Arr.appendAll(written, members);
}

/** Reads what a set of nodes adds to a header's row, side by side. */
function readAll(nodes: readonly Node[], reader: Reader) {
  return Arr.reduce(nodes, EMPTY_READING, (reading, node) =>
    joined(reading, readPart(node, reader))
  );
}

/**
 * What one node adds to a header's row: a group, a control such as a button, a link, a selector or a component that
 * draws one, a header with what its usage writes into it, or what a fragment, a condition or an expression holds. A
 * name written as it is, such as `{children}`, is a prop that the component places in its row.
 */
function readPart(node: Node, reader: Reader): Reading {
  if (isIdentifier(node)) {
    return { names: HashSet.make(node.text), row: EMPTY_ROW };
  }
  if (isJsxExpression(node) || isParenthesizedExpression(node)) {
    return node.expression === undefined
      ? EMPTY_READING
      : readPart(node.expression, reader);
  }
  if (isConditionalExpression(node)) {
    const whenTrue = readPart(node.whenTrue, reader);
    const whenFalse = readPart(node.whenFalse, reader);
    return {
      names: HashSet.union(whenTrue.names, whenFalse.names),
      row: either(whenTrue.row, whenFalse.row),
    };
  }
  if (
    isBinaryExpression(node) &&
    node.operatorToken.kind === SyntaxKind.AmpersandAmpersandToken
  ) {
    return readPart(node.right, reader);
  }
  if (isJsxFragment(node)) {
    return readAll(node.children, reader);
  }
  return Option.match(opening(node), {
    onNone: () => EMPTY_READING,
    onSome: ({ attributes, tag }) => {
      if (tag === GROUP_TAG || reader.isGroup(node)) {
        return { names: HashSet.empty(), row: GROUP_ROW };
      }
      if (tag !== undefined && QUIET_TAG_PATTERN.test(tag)) {
        return EMPTY_READING;
      }
      return Option.match(reader.headerOf(node), {
        onNone: () => ({
          names: HashSet.empty(),
          row: drawsIcon(node) || reader.isIcon(node) ? ICON_ROW : PILL_ROW,
        }),
        onSome: (header) => {
          const slots = readAll(
            slotContents(node, attributes, header.forwards),
            reader
          );
          return { names: slots.names, row: beside(header.own, slots.row) };
        },
      });
    },
  });
}

/**
 * The components a row reads by what they draw at their root: a `ButtonGroup`, such as a header's actions drawn by a
 * component of their own, which the row counts as its one group; and a control that shows an icon alone, such as the
 * outline toggle, every size its root writes being an icon size.
 */
function kindsOf(components: readonly Component[]): Kinds {
  const rooted = (test: (roots: readonly Node[]) => boolean) =>
    HashSet.fromIterable(
      Arr.filterMap(components, (component) => {
        const roots = rootsOf(component);
        return Arr.isReadonlyArrayNonEmpty(roots) && test(roots)
          ? Result.succeed(componentKey(component))
          : Result.failVoid;
      })
    );
  return {
    groups: rooted((roots) =>
      Arr.every(roots, (node) =>
        Option.exists(opening(node), ({ tag }) => tag === GROUP_TAG)
      )
    ),
    icons: rooted((roots) => Arr.every(roots, iconSized)),
  };
}

/** The rows a component draws: each `PageActions` it writes, and each header it uses, with what it places there. */
function rowsOf(
  component: Component,
  resolve: (file: string, tag: string) => Option.Option<Component>,
  headers: Headers,
  kinds: Kinds
) {
  const named = (element: Node) =>
    Option.flatMap(opening(element), ({ tag }) =>
      tag === undefined ? Option.none() : resolve(component.file, tag)
    );
  const reader: Reader = {
    headerOf: (element) =>
      Option.flatMap(named(element), (target) =>
        HashMap.get(headers, componentKey(target))
      ),
    isGroup: (element) =>
      Option.exists(named(element), (target) =>
        HashSet.has(kinds.groups, componentKey(target))
      ),
    isIcon: (element) =>
      Option.exists(named(element), (target) =>
        HashSet.has(kinds.icons, componentKey(target))
      ),
  };
  return Arr.flatMap(nodesBelow(component.body), (node) =>
    Option.toArray(
      Option.flatMap(opening(node), ({ attributes, tag }) => {
        const slot =
          tag === ACTIONS_TAG &&
          (component.file === ACTIONS_MODULE ||
            Option.exists(
              resolve(component.file, tag),
              ({ file }) => file === ACTIONS_MODULE
            ));
        if (slot) {
          return Option.some({
            header: Option.none<Header>(),
            node,
            reading: readAll(isJsxElement(node) ? node.children : [], reader),
          });
        }
        return Option.map(reader.headerOf(node), (header) => {
          const slots = readAll(
            slotContents(node, attributes, header.forwards),
            reader
          );
          return {
            header: Option.some(header),
            node,
            reading: {
              names: slots.names,
              row: beside(header.own, slots.row),
            },
          };
        });
      })
    )
  );
}

/** Every header component, read again until what each one places in its row stops changing. */
function settle(
  components: readonly Component[],
  resolve: (file: string, tag: string) => Option.Option<Component>,
  kinds: Kinds,
  headers: Headers,
  round = 1
): Headers {
  const next = HashMap.fromIterable(
    Arr.filterMap(components, (component) => {
      const rows = rowsOf(component, resolve, headers, kinds);
      const forwards = Arr.reduce(rows, HashSet.empty<string>(), (names, row) =>
        HashSet.union(names, row.reading.names)
      );
      // A component is a header when it places a prop in a header's row, so a usage writes part of that row.
      return HashSet.size(forwards) > 0
        ? Result.succeed([
            componentKey(component),
            {
              forwards,
              own: Arr.reduce(rows, EMPTY_ROW, (row, part) =>
                either(row, part.reading.row)
              ),
            },
          ] as const)
        : Result.failVoid;
    })
  );
  // A header that draws itself in its own row grows with every reading, so the readings stop at a bound.
  return Equal.equals(next, headers) || round === MOST_ROUNDS
    ? next
    : settle(components, resolve, kinds, next, round + 1);
}

/**
 * Reports a page header that shows more than two standalone pills, or a secondary icon action standing apart from its
 * one group. A header shows the page's search or primary as pills and keeps every other action in one ButtonGroup, so a
 * reader finds the page's main action at once. The row is `PageActions` of the page frame, read through every header
 * component that places a prop in it as it is, such as `SchoolHeader`'s children or BreadcrumbHeader's `value.action`,
 * so each usage counts what it writes there with what the header draws itself. A search field, a header's `search`
 * prop, and a dialog or a popup that a control opens are not in the row.
 */
export function inspectHeaderActions(
  modules: Parameters<typeof componentGraph>[0]
) {
  const { components, resolve } = componentGraph(modules);
  const kinds = kindsOf(components);
  const headers = settle(components, resolve, kinds, HashMap.empty());
  return Arr.flatMap(components, (component) =>
    Arr.filterMap(
      rowsOf(component, resolve, headers, kinds),
      ({ header, node, reading }) =>
        Option.match(crowding(reading.row), {
          onNone: () => Result.failVoid,
          onSome: (finding) =>
            Option.exists(header, ({ own }) => Option.isSome(crowding(own)))
              ? Result.failVoid
              : Result.succeed(
                  `${place(component.file, component.sourceFile, node)}: ${finding}`
                ),
        })
    )
  );
}

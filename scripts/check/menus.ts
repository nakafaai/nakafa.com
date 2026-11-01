import { Array as Arr, HashSet, Result } from "effect";
import {
  isCallExpression,
  isIdentifier,
  isJsxElement,
  isJsxSelfClosingElement,
  isPropertyAccessExpression,
  isVariableDeclaration,
  type Node,
  type SourceFile,
} from "typescript/unstable/ast";
import { nodesBelow, tagText } from "#scripts/check/drilling";
import { COMPONENT_SET_DIRECTORIES } from "#scripts/check/exports";

const JSX_MODULE_PATTERN = /\.tsx$/u;
/** The popups of a dropdown: a menu and a submenu, each of which names what it holds. */
const MENU_TAGS = HashSet.make("DropdownMenuContent", "DropdownMenuSubContent");
const LABEL_TAG = "DropdownMenuLabel";
/** The call that declares a table's columns, and its member that declares the row's menu. */
const COLUMNS_CALL = "tableColumns";
const MENU_MEMBER = "menu";
/** What draws a button: the component, or the classes that make a link look like one. */
const BUTTON_TAG = "Button";
const BUTTON_CLASSES = "buttonVariants";

/** Returns the tag of an element that a node opens, or nothing for any other node. */
function elementTag(node: Node) {
  if (isJsxElement(node)) {
    return tagText(node.openingElement.tagName);
  }
  return isJsxSelfClosingElement(node) ? tagText(node.tagName) : undefined;
}

/** Whether a call runs `columns.menu(...)` on the columns named `columns`. */
function callsMenu(node: Node, columns: string) {
  return (
    isCallExpression(node) &&
    isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === MENU_MEMBER &&
    isIdentifier(node.expression.expression) &&
    node.expression.expression.text === columns
  );
}

/** Whether a node draws a button, as `<Button>` or through its classes. */
function drawsButton(node: Node) {
  return (
    elementTag(node) === BUTTON_TAG ||
    (isCallExpression(node) &&
      isIdentifier(node.expression) &&
      node.expression.text === BUTTON_CLASSES)
  );
}

/**
 * Reports the three ways a menu falls short. A dropdown names what it holds in one word, so a
 * popup written with items alone is refused; its label stands in the popup's own markup, where
 * this rule and a reader both find it. Every row of a table has one action, so a table's columns
 * declare the row's menu, and that menu column draws no button of its own beside it. The menu
 * column's cell gives `RowItems` its items, and the table draws the button. The component sets that a
 * registry ships keep their upstream shape.
 */
export function inspectMenuSource(file: string, sourceFile: SourceFile) {
  if (
    !JSX_MODULE_PATTERN.test(file) ||
    Arr.some(COMPONENT_SET_DIRECTORIES, (directory) =>
      file.startsWith(directory)
    )
  ) {
    return [];
  }
  const nodes = nodesBelow(sourceFile);
  const unlabelled = Arr.filter(nodes, (node) => {
    const tag = elementTag(node);
    return (
      tag !== undefined &&
      HashSet.has(MENU_TAGS, tag) &&
      !Arr.some(nodesBelow(node), (child) => elementTag(child) === LABEL_TAG)
    );
  });
  const tables = Arr.filterMap(nodes, (node) =>
    isVariableDeclaration(node) &&
    isIdentifier(node.name) &&
    node.initializer !== undefined &&
    isCallExpression(node.initializer) &&
    isIdentifier(node.initializer.expression) &&
    node.initializer.expression.text === COLUMNS_CALL
      ? Result.succeed(node.name.text)
      : Result.failVoid
  );
  return Arr.flatten([
    Arr.map(
      unlabelled,
      () =>
        `${file}: a dropdown holds no DropdownMenuLabel. Every dropdown names what it holds in one word: add the label inside its DropdownMenuGroup.`
    ),
    Arr.flatMap(tables, (table) => {
      const menus = Arr.filter(nodes, (node) => callsMenu(node, table));
      return Arr.isReadonlyArrayEmpty(menus)
        ? [
            `${file}: ${table} has no menu column. Every row of every table has one action: declare ${table}.menu(...), whose cell gives RowItems the row's items.`,
          ]
        : Arr.flatMap(menus, (menu) =>
            Arr.some(nodesBelow(menu), drawsButton)
              ? [
                  `${file}: ${table}.menu draws a button. A row's one action is the three-dot menu the table draws: give RowItems a DropdownMenuItem instead.`,
                ]
              : []
          );
    }),
  ]);
}

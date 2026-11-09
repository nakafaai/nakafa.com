import { Array as Arr, HashSet, Option, Result } from "effect";
import {
  isArrowFunction,
  isCallExpression,
  isFunctionExpression,
  isIdentifier,
  isObjectBindingPattern,
  isJsxAttribute,
  isJsxElement,
  isJsxExpression,
  isJsxOpeningElement,
  isJsxSelfClosingElement,
  isPropertyAccessExpression,
  isStringLiteralLikeNode,
  isTemplateExpression,
  isVariableDeclaration,
  type JsxAttributes,
  type Node,
  type SourceFile,
} from "tsrs/ast";
import { nodesBelow, tagText } from "#scripts/check/drilling";
import { COMPONENT_SET_DIRECTORIES } from "#scripts/check/exports";

const JSX_MODULE_PATTERN = /\.tsx$/u;
/**
 * The popups of a dropdown: a menu, a submenu, a select's list and a picker's list. Each requires its `label`, the one
 * word that names what is chosen, and reads it from a key of the `menu-` family, which the dictionary check holds to
 * one word.
 */
const POPUP_TAGS = HashSet.make(
  "DropdownMenuContent",
  "DropdownMenuSubContent",
  "PickerContent",
  "SelectContent"
);
const LABEL_ATTRIBUTE = "label";
/** A key of the label family, alone or under its namespace, such as `menu-actions` or `Common.menu-actions`. */
const MENU_KEY_PATTERN = /(?:^|\.)menu-[^.]+$/u;
/** The label of a sidebar's group, and what draws an icon. */
const SIDEBAR_LABEL_TAG = "SidebarGroupLabel";
const ICON_TAG = "HugeIcons";
/** The call that declares a table's columns, and its member that declares the row's menu. */
const COLUMNS_CALL = "tableColumns";
const MENU_MEMBER = "menu";
/**
 * The registries whose every entry carries its own mark: a language the flag of its country, and a country its flag.
 * An option drawn for each entry shows that mark, never one icon for the whole list.
 */
const MARKED_REGISTRIES = HashSet.make("countries", "languages");
/** The options of a menu, a select and a picker, each of which takes the `icon` it shows before its words. */
const OPTION_TAGS = HashSet.make(
  "DropdownMenuCheckboxItem",
  "DropdownMenuItem",
  "DropdownMenuRadioItem",
  "DropdownMenuSubTrigger",
  "PickerItem",
  "SelectItem"
);
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

/** The expression or text a popup's label is written as, or none when it names no label. */
function labelOf(attributes: JsxAttributes) {
  return Arr.findFirst(
    attributes.properties,
    (property): Option.Option<Node> => {
      if (
        !(
          isJsxAttribute(property) &&
          isIdentifier(property.name) &&
          property.name.text === LABEL_ATTRIBUTE &&
          property.initializer !== undefined
        )
      ) {
        return Option.none();
      }
      const { initializer } = property;
      return isJsxExpression(initializer)
        ? Option.fromNullishOr(initializer.expression)
        : Option.some(initializer);
    }
  );
}

/**
 * Whether a popup's label is written as text of its own rather than read from the label family: a literal, a
 * template, or a lookup of any other key. A label the component receives from its caller passes, and its caller
 * reads the key.
 */
function writesOwnLabel(label: Node) {
  if (isStringLiteralLikeNode(label) || isTemplateExpression(label)) {
    return true;
  }
  if (!isCallExpression(label)) {
    return false;
  }
  const [key] = label.arguments;
  return !(
    key !== undefined &&
    isStringLiteralLikeNode(key) &&
    MENU_KEY_PATTERN.test(key.text)
  );
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

/** The names that a callback binds to the entry it maps: `language`, or each name of `({ value, country })`. */
function entryNames(callback: Node) {
  if (!(isArrowFunction(callback) || isFunctionExpression(callback))) {
    return HashSet.empty<string>();
  }
  return HashSet.fromIterable(
    Arr.flatMap(Arr.take(callback.parameters, 1), ({ name }) => {
      if (isIdentifier(name)) {
        return [name.text];
      }
      return isObjectBindingPattern(name)
        ? Arr.flatMap(name.elements, ({ name: inner }) =>
            inner !== undefined && isIdentifier(inner) ? [inner.text] : []
          )
        : [];
    })
  );
}

/** The registry and the callback of `Arr.map(languages, (language) => ...)` or `languages.map(...)`. */
function markedMap(node: Node) {
  if (!isCallExpression(node)) {
    return Option.none();
  }
  const callee = node.expression;
  const method = isPropertyAccessExpression(callee) && callee.name.text === "map";
  const [first, second] = node.arguments;
  if (
    method &&
    isIdentifier(callee.expression) &&
    callee.expression.text === "Arr" &&
    first !== undefined &&
    isIdentifier(first) &&
    HashSet.has(MARKED_REGISTRIES, first.text) &&
    second !== undefined
  ) {
    return Option.some({ callback: second, registry: first.text });
  }
  return method &&
    isIdentifier(callee.expression) &&
    HashSet.has(MARKED_REGISTRIES, callee.expression.text) &&
    first !== undefined
    ? Option.some({ callback: first, registry: callee.expression.text })
    : Option.none();
}

/**
 * The registries mapped to options whose icon ignores the entry: every option of the list would show one icon where
 * each entry carries a mark of its own.
 */
function unmarkedOptions(nodes: readonly Node[]) {
  return Arr.filterMap(nodes, (node) =>
    Option.match(markedMap(node), {
      onNone: () => Result.failVoid,
      onSome: ({ callback, registry }) => {
        const names = entryNames(callback);
        const ignored = Arr.some(nodesBelow(callback), (child) => {
          if (!(isJsxOpeningElement(child) || isJsxSelfClosingElement(child))) {
            return false;
          }
          const tag = tagText(child.tagName);
          return (
            tag !== undefined &&
            HashSet.has(OPTION_TAGS, tag) &&
            Arr.some(
              child.attributes.properties,
              (attribute) =>
                isJsxAttribute(attribute) &&
                isIdentifier(attribute.name) &&
                attribute.name.text === "icon" &&
                attribute.initializer !== undefined &&
                !Arr.some(
                  nodesBelow(attribute.initializer),
                  (part) => isIdentifier(part) && HashSet.has(names, part.text)
                )
            )
          );
        });
        return ignored ? Result.succeed(registry) : Result.failVoid;
      },
    })
  );
}

/**
 * Reports the ways a menu falls short. A sidebar group's label is text alone, so it never reads as
 * one of the items under it. A dropdown or a select names what it holds in one word: the design system requires the
 * popup's `label`, and this rule holds it to a key of the `menu-` family, which holds one word in every language.
 * Every row of a table has one action, so a table's columns
 * declare the row's menu, and that menu column draws no button of its own beside it. The menu
 * column's cell gives `RowItems` its items, and the table draws the button. An option drawn for each language or
 * country shows that entry's flag, never one icon for the whole list. The component sets that a registry ships keep
 * their upstream shape.
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
  const ownLabels = Arr.filterMap(nodes, (node) => {
    if (!(isJsxOpeningElement(node) || isJsxSelfClosingElement(node))) {
      return Result.failVoid;
    }
    const tag = tagText(node.tagName);
    if (tag === undefined || !HashSet.has(POPUP_TAGS, tag)) {
      return Result.failVoid;
    }
    return Option.match(labelOf(node.attributes), {
      onNone: () => Result.failVoid,
      onSome: (label) =>
        writesOwnLabel(label) ? Result.succeed(tag) : Result.failVoid,
    });
  });
  const iconLabels = Arr.filter(
    nodes,
    (node) =>
      elementTag(node) === SIDEBAR_LABEL_TAG &&
      Arr.some(nodesBelow(node), (child) => elementTag(child) === ICON_TAG)
  );
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
      unmarkedOptions(nodes),
      (registry) =>
        `${file}: the options of ${registry} show one icon for every entry. Each entry carries its own flag: draw it from the entry, as the language lists of components/shared/language do.`
    ),
    Arr.map(
      iconLabels,
      () =>
        `${file}: a sidebar group label holds an icon. A group label is text alone: keep the icon on the items under it.`
    ),
    Arr.map(
      ownLabels,
      (tag) =>
        `${file}: a ${tag} writes its own label. A dropdown names what is chosen in one word: read it from a menu- key, such as label={t("menu-actions")}.`
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

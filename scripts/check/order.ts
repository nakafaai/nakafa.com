import { Array as Arr, HashSet, Option, Schema } from "effect";
import {
  isCallExpression,
  isIdentifier,
  isJsxAttribute,
  isJsxElement,
  isJsxExpression,
  isJsxSelfClosingElement,
  isStringLiteralLikeNode,
  type JsxAttributes,
  type Node,
  type SourceFile,
} from "tsrs/ast";
import { nodesBelow, tagText } from "#scripts/check/drilling";
import { COMPONENT_SET_DIRECTORIES } from "#scripts/check/exports";
import { children } from "#scripts/check/source";

const JSX_MODULE_PATTERN = /\.tsx$/u;
/**
 * A menu reads as header, body and footer: its label, its main actions, then a separator and Archive and Delete
 * last. Each popup of items is read on its own, a table row's `RowItems` included, and a submenu is its own menu.
 */
const MENU_SCOPE_TAGS = HashSet.make(
  "DropdownMenuContent",
  "DropdownMenuSubContent",
  "RowItems"
);
const SUBMENU_TAG = "DropdownMenuSubContent";
const SEPARATOR_TAG = "DropdownMenuSeparator";
const ITEM_TAGS = HashSet.make(
  "DropdownMenuItem",
  "DropdownMenuRadioItem",
  "DropdownMenuCheckboxItem",
  "DropdownMenuSubTrigger"
);
/** Where an item stands in its menu: the separator, a main action, or the footer's archive and delete. */
const MenuPart = Schema.Literals(["separator", "main", "archive", "delete"]);
/** An archive item draws the archive icon or reads a key such as `archive` or `class-archive`; a restore does neither. */
const ARCHIVE_ICON_PATTERN = /^Archive\d*Icon$/u;
const ARCHIVE_KEY_PATTERN = /(?:^|-)archive$/u;
const DESTRUCTIVE_VARIANT = "destructive";

/** The tag and attributes of an element that a node opens, or none for any other node. */
function opening(node: Node) {
  if (isJsxElement(node)) {
    return Option.some({
      attributes: node.openingElement.attributes,
      tag: tagText(node.openingElement.tagName),
    });
  }
  return isJsxSelfClosingElement(node)
    ? Option.some({ attributes: node.attributes, tag: tagText(node.tagName) })
    : Option.none();
}

/** The expression an attribute holds in braces, or its quoted text, by the attribute's name. */
function attributeValue(attributes: JsxAttributes, name: string) {
  return Arr.findFirst(attributes.properties, (property) =>
    isJsxAttribute(property) &&
    isIdentifier(property.name) &&
    property.name.text === name &&
    property.initializer !== undefined
      ? Option.some<Node>(
          isJsxExpression(property.initializer) &&
            property.initializer.expression !== undefined
            ? property.initializer.expression
            : property.initializer
        )
      : Option.none()
  );
}

/** Where one item stands: Delete when it is destructive, Archive when it archives, a main action otherwise. */
function itemPart(item: Node, attributes: JsxAttributes): typeof MenuPart.Type {
  const named = (name: string, test: (value: Node) => boolean) =>
    Option.exists(attributeValue(attributes, name), test);
  if (
    named(
      "variant",
      (value) =>
        isStringLiteralLikeNode(value) && value.text === DESTRUCTIVE_VARIANT
    )
  ) {
    return "delete";
  }
  const archives =
    named(
      "icon",
      (value) => isIdentifier(value) && ARCHIVE_ICON_PATTERN.test(value.text)
    ) ||
    Arr.some(nodesBelow(item), (node) => {
      if (!isCallExpression(node)) {
        return false;
      }
      const [key] = node.arguments;
      return (
        key !== undefined &&
        isStringLiteralLikeNode(key) &&
        ARCHIVE_KEY_PATTERN.test(key.text)
      );
    });
  return archives ? "archive" : "main";
}

/** The parts of one menu in the order a reader meets them, leaving its submenus to their own reading. */
function menuParts(node: Node): readonly (typeof MenuPart.Type)[] {
  return Arr.flatMap(children(node), (child) =>
    Option.match(opening(child), {
      onNone: () => menuParts(child),
      onSome: ({ attributes, tag }) => {
        if (tag === SUBMENU_TAG) {
          return [];
        }
        if (tag === SEPARATOR_TAG) {
          return ["separator" as const];
        }
        return tag !== undefined && HashSet.has(ITEM_TAGS, tag)
          ? [itemPart(child, attributes)]
          : menuParts(child);
      },
    })
  );
}

/** Reports how one menu falls short of label, actions, separator, then Archive and Delete last. */
function orderFindings(file: string, parts: readonly (typeof MenuPart.Type)[]) {
  const footer = (part: typeof MenuPart.Type) =>
    part === "archive" || part === "delete";
  return Option.match(Arr.findFirstIndex(parts, footer), {
    onNone: () => [],
    onSome: (start) => {
      const afterDelete = Option.match(
        Arr.findFirstIndex(parts, (part) => part === "delete"),
        {
          onNone: () => [],
          onSome: (index) => Arr.drop(parts, index),
        }
      );
      return Arr.flatten([
        start > 0 && !Option.contains(Arr.get(parts, start - 1), "separator")
          ? [
              `${file}: a destructive or archive item sits among a menu's main actions. A menu reads its label, its actions, then a DropdownMenuSeparator and Archive and Delete last: put the separator before it.`,
            ]
          : [],
        Arr.some(Arr.drop(parts, start), (part) => part === "main")
          ? [
              `${file}: a main action follows a menu's archive or delete. Archive and Delete close the menu below its separator: move the action above it.`,
            ]
          : [],
        Arr.some(afterDelete, (part) => part === "archive")
          ? [
              `${file}: a menu offers Delete before Archive. Archive comes first, and Delete closes the menu.`,
            ]
          : [],
      ]);
    },
  });
}

/**
 * Reports every menu that does not read as header, body and footer: its label, its main actions, and below a
 * separator Archive and Delete last, so a destructive item never stands among the actions a reader picks every day.
 * Each menu of a module is read in its source order. The component sets that a registry ships keep their upstream
 * shape.
 */
export function inspectMenuOrder(file: string, sourceFile: SourceFile) {
  if (
    !JSX_MODULE_PATTERN.test(file) ||
    Arr.some(COMPONENT_SET_DIRECTORIES, (directory) =>
      file.startsWith(directory)
    )
  ) {
    return [];
  }
  return Arr.flatMap(nodesBelow(sourceFile), (node) =>
    Option.exists(
      opening(node),
      ({ tag }) => tag !== undefined && HashSet.has(MENU_SCOPE_TAGS, tag)
    )
      ? orderFindings(file, menuParts(node))
      : []
  );
}

import { Array as Arr, HashSet, Option, Result } from "effect";
import {
  isArrowFunction,
  isBindingElement,
  isCallExpression,
  isFunctionExpression,
  isIdentifier,
  isParameterDeclaration,
  isPropertyAccessExpression,
  isVariableDeclaration,
  type Node,
  type SourceFile,
} from "tsrs/ast";
import { nodesBelow } from "#scripts/check/drilling";
import { attributeValue, judgesMarkup, opening } from "#scripts/check/jsx";
import { place } from "#scripts/check/places";
import { children } from "#scripts/check/source";

/** The options of a menu, a select and a picker, each of which shows the `icon` of its kind before its words. */
const OPTION_TAGS = HashSet.make(
  "DropdownMenuCheckboxItem",
  "DropdownMenuItem",
  "DropdownMenuRadioItem",
  "DropdownMenuSubTrigger",
  "PickerItem",
  "SelectItem"
);
const ICON_ATTRIBUTE = "icon";
const MAP_MEMBER = "map";

/** The icon expression of an option element, or none for any other node. */
function optionIcon(node: Node) {
  return Option.flatMap(
    Option.filter(
      opening(node),
      ({ tag }) => tag !== undefined && HashSet.has(OPTION_TAGS, tag)
    ),
    ({ attributes }) => attributeValue(attributes, ICON_ATTRIBUTE)
  );
}

/** The callback of a `map`: `items.map(fn)`, `Arr.map(items, fn)`, or the data-last `Arr.map(fn)`. */
function mapCallback(node: Node) {
  if (
    !(
      isCallExpression(node) &&
      isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === MAP_MEMBER
    )
  ) {
    return Option.none();
  }
  return Option.filter(
    Arr.last(node.arguments),
    (callback) => isArrowFunction(callback) || isFunctionExpression(callback)
  );
}

/** The names a callback binds, its parameters and the variables it declares, which differ for every item. */
function boundNames(callback: Node) {
  return HashSet.fromIterable(
    Arr.filterMap(nodesBelow(callback), (node) =>
      (isParameterDeclaration(node) ||
        isBindingElement(node) ||
        isVariableDeclaration(node)) &&
      node.name !== undefined &&
      isIdentifier(node.name)
        ? Result.succeed(node.name.text)
        : Result.failVoid
    )
  );
}

/** Whether an icon reads none of the names a callback binds, so every item of the list shows it alike. */
function sharedByEveryItem(icon: Node, bound: HashSet.HashSet<string>) {
  return !Arr.some(
    Arr.prepend(nodesBelow(icon), icon),
    (node) => isIdentifier(node) && HashSet.has(bound, node.text)
  );
}

/** The options written side by side under one element, by the text of the icon each one shows. */
function writtenIcons(sourceFile: SourceFile, node: Node) {
  return Arr.filterMap(children(node), (child) =>
    Option.match(optionIcon(child), {
      onNone: () => Result.failVoid,
      onSome: (icon) => Result.succeed(iconText(sourceFile, icon)),
    })
  );
}

/** The source text of an icon expression, such as `TranslateIcon`. */
function iconText(sourceFile: SourceFile, icon: Node) {
  return sourceFile.text.slice(icon.getStart(sourceFile), icon.end);
}

/**
 * Reports a list whose options all show one icon, which tells them apart by nothing: options drawn in a `map` whose
 * icon reads nothing of the item, and two or more options written side by side that all name the same icon. Each
 * option shows its own icon or the entry's own mark, such as a language's flag, and a list of values whose trigger
 * already shows their kind's icon marks its options `plain`, which shows none.
 */
export function inspectOptionSource(file: string, sourceFile: SourceFile) {
  if (!judgesMarkup(file)) {
    return [];
  }
  const nodes = nodesBelow(sourceFile);
  const mapped = Arr.flatMap(nodes, (node) =>
    Option.match(mapCallback(node), {
      onNone: () => [],
      onSome: (callback) => {
        const bound = boundNames(callback);
        return Arr.filterMap(nodesBelow(callback), (below) =>
          Option.match(optionIcon(below), {
            onNone: () => Result.failVoid,
            onSome: (icon) =>
              sharedByEveryItem(icon, bound)
                ? Result.succeed(
                    `${place(file, sourceFile, below)}: every option of this list shows ${iconText(sourceFile, icon)}: give each option its own icon, or mark a list of values plain.`
                  )
                : Result.failVoid,
          })
        );
      },
    })
  );
  const written = Arr.filterMap(nodes, (node) => {
    const icons = writtenIcons(sourceFile, node);
    return Option.match(Arr.head(icons), {
      onNone: () => Result.failVoid,
      onSome: (first) =>
        icons.length > 1 && Arr.every(icons, (icon) => icon === first)
          ? Result.succeed(
              `${place(file, sourceFile, node)}: ${icons.length} options side by side all show ${first}: give each option its own icon, or mark a list of values plain.`
            )
          : Result.failVoid,
    });
  });
  return Arr.appendAll(mapped, written);
}

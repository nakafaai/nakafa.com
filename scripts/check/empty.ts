import { Array as Arr, HashSet, Option, Result } from "effect";
import {
  isFunctionDeclaration,
  isIdentifier,
  isImportDeclaration,
  isStringLiteral,
  isVariableDeclaration,
  type Node,
  type SourceFile,
} from "tsrs/ast";
import { nodesBelow } from "#scripts/check/drilling";
import { attributeValue, judgesMarkup, opening } from "#scripts/check/jsx";
import { place } from "#scripts/check/places";

/** The one empty state and the folder that owns it, the only place that composes the design system's empty parts. */
const STATE_TAG = "EmptyState";
const STATE_DIRECTORY = "apps/www/src/components/state/";
const PARTS_MODULE = "@repo/design-system/components/ui/empty";
/** Nina in a framed state, drawn at once or loaded apart with her place kept, and her figure on a whole page's state. */
const SCENE_TAGS = HashSet.make(
  "EmptyNina",
  "DeferredEmptyNina",
  "DeferredFigure"
);
/** A component that names itself an empty state, such as `FeedEmpty`. */
const EMPTY_NAME_PATTERN = /^[A-Z]\w*Empty$/u;

/** The name of a component that a node declares, as a function or as a variable that holds one. */
function componentName(
  node: Node
): Option.Option<{ readonly body: Node; readonly name: string }> {
  if (isFunctionDeclaration(node) && node.name !== undefined) {
    return Option.some({ body: node, name: node.name.text });
  }
  return isVariableDeclaration(node) &&
    isIdentifier(node.name) &&
    node.initializer !== undefined
    ? Option.some({ body: node.initializer, name: node.name.text })
    : Option.none();
}

/** Whether a scene shows Nina: every element the expression draws is her, and a value it reads is left to its owner. */
function showsNina(scene: Node) {
  const drawn = Arr.filterMap(Arr.prepend(nodesBelow(scene), scene), (node) =>
    Option.match(opening(node), {
      onNone: () => Result.failVoid,
      onSome: ({ tag }) => Result.succeed(tag),
    })
  );
  return Arr.some(
    drawn,
    (tag) => tag !== undefined && HashSet.has(SCENE_TAGS, tag)
  );
}

/**
 * Reports an empty state that is not Nakafa's one empty state with Nina in it. `EmptyState` takes its `scene`, Nina
 * doing what fits the place (`EmptyNina`, or `DeferredEmptyNina` where her code loads apart) or a whole page's figure
 * (`DeferredFigure`), so every empty list, failed read
 * and missing page shows her. The design system's empty parts are composed in the state folder alone, and a component
 * named as an empty state, such as `FeedEmpty`, draws `EmptyState` rather than a sentence of its own.
 */
export function inspectEmptySource(file: string, sourceFile: SourceFile) {
  if (!judgesMarkup(file) || file.startsWith(STATE_DIRECTORY)) {
    return [];
  }
  const parts = Arr.filterMap(sourceFile.statements, (statement) =>
    isImportDeclaration(statement) &&
    isStringLiteral(statement.moduleSpecifier) &&
    statement.moduleSpecifier.text === PARTS_MODULE
      ? Result.succeed(
          `${place(file, sourceFile, statement)}: an empty state is built from the parts of ${PARTS_MODULE}. Draw EmptyState from components/state/empty, which gives every empty place its scene, its title and its way on.`
        )
      : Result.failVoid
  );
  const nodes = nodesBelow(sourceFile);
  const sceneless = Arr.filterMap(nodes, (node) =>
    Option.match(opening(node), {
      onNone: () => Result.failVoid,
      onSome: ({ attributes, tag }) =>
        tag === STATE_TAG &&
        !Option.exists(attributeValue(attributes, "scene"), showsNina)
          ? Result.succeed(
              `${place(file, sourceFile, node)}: an EmptyState shows no Nina. Give it scene={<EmptyNina act="..." />}, DeferredEmptyNina where her code loads apart, or a whole page's DeferredFigure, so every empty place shows her.`
            )
          : Result.failVoid,
    })
  );
  const bespoke = Arr.filterMap(nodes, (node) =>
    Option.match(componentName(node), {
      onNone: () => Result.failVoid,
      onSome: ({ body, name }) =>
        EMPTY_NAME_PATTERN.test(name) &&
        !Arr.some(nodesBelow(body), (below) =>
          Option.exists(opening(below), ({ tag }) => tag === STATE_TAG)
        )
          ? Result.succeed(
              `${place(file, sourceFile, node)}: ${name} draws an empty state of its own. Draw EmptyState with Nina in its scene instead.`
            )
          : Result.failVoid,
    })
  );
  return Arr.flatten([parts, sceneless, bespoke]);
}

import { Array as Arr, Option, Order, pipe, Result } from "effect";
import type { Node, SourceFile } from "tsrs/ast";
import {
  isIdentifier,
  isPropertyAssignment,
  isStringLiteralLikeNode,
  isVariableStatement,
} from "tsrs/ast";
import { nodesBelow } from "#scripts/check/drilling";
import { attributeValue, judgesMarkup, opening } from "#scripts/check/jsx";
import { place } from "#scripts/check/places";

/**
 * The elements that draw Nina doing something: herself, and every component named for her that hands its act on to
 * her, such as her place in an empty state or the try-out demo's Nina. A toy (`NinaToy`) is named for a toy, and it
 * stands in for its section's own Nina, so it is no place of its own.
 */
const NINA_TAG = /Nina$/u;
/** The attribute, and the property of a table of scenes, that names what she does. */
const ACT = "act";
/** How many of an act's other places a finding names before it counts the rest. */
const NAMED_PLACES = 3;

/** The texts of the string literals at and below a node. */
function literalsOf(node: Node) {
  return Arr.filterMap(Arr.prepend(nodesBelow(node), node), (below) =>
    isStringLiteralLikeNode(below)
      ? Result.succeed({ node: below, text: below.text })
      : Result.failVoid
  );
}

/** The initializer of the constant a module declares at its top under a name, such as a table of acts by state. */
function constant(sourceFile: SourceFile, name: string) {
  return Arr.findFirst(
    Arr.flatMap(sourceFile.statements, (statement) =>
      isVariableStatement(statement)
        ? statement.declarationList.declarations
        : []
    ),
    (declaration) =>
      isIdentifier(declaration.name) &&
      declaration.name.text === name &&
      declaration.initializer !== undefined
        ? Option.some<Node>(declaration.initializer)
        : Option.none()
  );
}

/**
 * The acts an `act` attribute can hold: every literal it writes, on both sides of a choice too, and for a value read
 * from a table the module declares, every literal of that table. A value a component only hands on, such as a
 * wrapper's own `act` prop, names no act here: the module that writes the literal does.
 */
function attributeActs(sourceFile: SourceFile, value: Node) {
  const written = literalsOf(value);
  if (Arr.isReadonlyArrayNonEmpty(written)) {
    return written;
  }
  return Arr.flatMap(Arr.prepend(nodesBelow(value), value), (below) =>
    isIdentifier(below)
      ? Option.match(constant(sourceFile, below.text), {
          onNone: () => [],
          onSome: literalsOf,
        })
      : []
  );
}

/** Every act a module draws Nina with, once each, at the first line that names it. */
function drawnActs(file: string, sourceFile: SourceFile) {
  const nodes = nodesBelow(sourceFile);
  const attributes = Arr.flatMap(nodes, (node) =>
    Option.match(opening(node), {
      onNone: () => [],
      onSome: ({ attributes: held, tag }) =>
        tag !== undefined && NINA_TAG.test(tag)
          ? Option.match(attributeValue(held, ACT), {
              onNone: () => [],
              onSome: (value) => attributeActs(sourceFile, value),
            })
          : [],
    })
  );
  const scenes = Arr.filterMap(nodes, (node) =>
    isPropertyAssignment(node) &&
    isIdentifier(node.name) &&
    node.name.text === ACT &&
    isStringLiteralLikeNode(node.initializer)
      ? Result.succeed({ node: node.initializer, text: node.initializer.text })
      : Result.failVoid
  );
  return pipe(
    Arr.appendAll(attributes, scenes),
    Arr.dedupeWith((one, other) => one.text === other.text),
    Arr.map(({ node, text }) => ({
      act: text,
      file,
      place: place(file, sourceFile, node),
    }))
  );
}

/**
 * Reports an act that Nina does in two places. Every place that shows her whole gives her the one thing that fits
 * what she does there, so a reader who meets her twice never sees the same picture: an act belongs to one module, which
 * may draw it for several states of its own place. The rule reads the `act` of `Nina` and of every component
 * named for her, a table of acts the attribute reads, and the `act` of a table of scenes. A toy that stands in
 * for a section's own Nina (`NinaToy`) is that same Nina, so it names no second place.
 */
export function inspectPoses(
  modules: readonly {
    readonly file: string;
    readonly sourceFile: SourceFile;
  }[]
): readonly string[] {
  const drawn = Arr.flatMap(modules, ({ file, sourceFile }) =>
    judgesMarkup(file) ? drawnActs(file, sourceFile) : []
  );
  return Arr.flatMap(drawn, (one) => {
    const others = Arr.sort(
      Arr.filterMap(drawn, (other) =>
        other.act === one.act && other.file !== one.file
          ? Result.succeed(other.file)
          : Result.failVoid
      ),
      Order.String
    );
    if (Arr.isReadonlyArrayEmpty(others)) {
      return [];
    }
    const rest = others.length - NAMED_PLACES;
    const named = Arr.join(Arr.take(others, NAMED_PLACES), ", ");
    return [
      `${one.place}: Nina is "${one.act}" here and in ${others.length} other ${others.length === 1 ? "place" : "places"} (${named}${rest > 0 ? `, and ${rest} more` : ""}). Give this place an act of its own from packages/mascot/nina/act.ts, the one that fits what she does here, so she never does one thing in two places.`,
    ];
  });
}

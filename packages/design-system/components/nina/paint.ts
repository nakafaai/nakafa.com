import type { Mark } from "@repo/mascot/nina/mark";
import type { Shape } from "@repo/mascot/shape";
import { Array as Arr, Equal, Record as Rec } from "effect";
import { camelCaseAttributes, camelToDash } from "motion";

/** What she is drawn from, in the order it is drawn. */
type Shapes = readonly Shape<Mark>[];

/**
 * What a shape sets on its element: everything but the name of the element,
 * the mark that names it for her life, and the shapes it holds.
 */
function settings(shape: Shape<Mark>): Readonly<Record<string, unknown>> {
  if (shape._tag === "g") {
    const { _tag, children, mark, ...rest } = shape;
    return rest;
  }
  const { _tag, mark, ...rest } = shape;
  return rest;
}

/** The name that the browser gives an attribute that React names `name`. */
function attributeName(name: string) {
  return camelCaseAttributes.has(name) ? name : camelToDash(name);
}

/** Whether two shapes are the same kind of shape with the same mark, and, for a group, hold the same shapes. */
function sameShape(before: Shape<Mark>, after: Shape<Mark>): boolean {
  if (before._tag === "g" && after._tag === "g") {
    return (
      Equal.equals(before.mark, after.mark) &&
      sameFigure(before.children, after.children)
    );
  }
  return before._tag === after._tag && Equal.equals(before.mark, after.mark);
}

/**
 * Whether two pictures are made of the same elements in the same places, so
 * that the elements that draw one can take the numbers of the other. A shape
 * that comes or goes, or that is another kind of shape or another mark, makes
 * them different.
 */
export function sameFigure(before: Shapes, after: Shapes): boolean {
  return (
    before.length === after.length &&
    Arr.every(before, (shape, index) => sameShape(shape, after[index]))
  );
}

/** Writes what a shape sets differently now than it did before, and takes away what it no longer sets. */
function repaint(element: Element, before: Shape<Mark>, after: Shape<Mark>) {
  const was = settings(before);
  const now = settings(after);
  Arr.forEach(Rec.keys({ ...was, ...now }), (name) => {
    const value = now[name];
    if (value === was[name]) {
      return;
    }
    if (value === undefined) {
      element.removeAttribute(attributeName(name));
      return;
    }
    element.setAttribute(attributeName(name), String(value));
  });
}

/**
 * Moves the numbers of one frame of her to the next without drawing her again:
 * it writes only what changed onto the elements that `Drawing` made for the
 * first. The two pictures must be the same figure (`sameFigure`), and `parent`
 * holds exactly the elements of `before`.
 */
export function paint(parent: Element, before: Shapes, after: Shapes): void {
  Arr.forEach(after, (shape, index) => {
    const element = parent.children[index];
    const was = before[index];
    repaint(element, was, shape);
    if (shape._tag === "g" && was._tag === "g") {
      paint(element, was.children, shape.children);
    }
  });
}

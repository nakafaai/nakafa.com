import { attributeName, attributesOf } from "@repo/design-system/lib/attribute";
import type { Mark } from "@repo/mascot/nina/mark";
import type { Shape } from "@repo/mascot/shape";
import { Array as Arr, Equal, Record as Rec } from "effect";

/** What she is drawn from, in the order it is drawn. */
type Shapes = readonly Shape<Mark>[];

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
  const was = attributesOf(before);
  const now = attributesOf(after);
  Arr.forEach(Rec.keys({ ...was, ...now }), (field) => {
    const value = now[field];
    if (value === was[field]) {
      return;
    }
    if (value === undefined) {
      element.removeAttribute(attributeName(field));
      return;
    }
    element.setAttribute(attributeName(field), String(value));
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

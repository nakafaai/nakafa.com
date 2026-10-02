import type { CSSProperties } from "react";

/**
 * The space a card takes in the page: its height and vertical margins, as the
 * style its slot keeps while the card fills the screen.
 */
export type VisualPlace = Required<
  Pick<CSSProperties, "height" | "marginBottom" | "marginTop">
>;

/** The root's padding that stands in for its scrollbar gutters. */
type GutterPadding = Pick<CSSStyleDeclaration, "paddingLeft" | "paddingRight">;

/**
 * Measures the card's place in the page. A margin of the card collapses with
 * its neighbours through the slot, and the slot's own margin collapses the
 * same way, so copying it keeps every neighbour where it was.
 */
function measurePlace(card: HTMLElement): VisualPlace {
  const { marginBottom, marginTop } = getComputedStyle(card);
  return {
    height: card.getBoundingClientRect().height,
    marginBottom,
    marginTop,
  };
}

/**
 * Measures the root's padding plus the scrollbar gutter at each side of the
 * viewport. Where scrollbars take space, such as on Windows and Linux, the
 * root keeps its gutters (`scrollbar-gutter: stable`) even while it cannot
 * scroll. Overlay scrollbars, on phones and by default on macOS, take none,
 * and a pinch-zoomed phone can report a viewport narrower than the page.
 */
function measureGutterPadding(root: HTMLElement): GutterPadding {
  const { left, right } = root.getBoundingClientRect();
  const style = getComputedStyle(root);
  const start = Math.max(0, left - Number.parseFloat(style.marginLeft));
  const end = Math.max(
    0,
    window.innerWidth - right - Number.parseFloat(style.marginRight)
  );
  return {
    paddingLeft: `${Number.parseFloat(style.paddingLeft) + start}px`,
    paddingRight: `${Number.parseFloat(style.paddingRight) + end}px`,
  };
}

/**
 * Makes every element outside the card inert, from its siblings up to the
 * children of `body`, and returns the undo. Elements that were already inert
 * stay inert.
 */
function inertOutside(card: HTMLElement) {
  const inerted: Element[] = [];
  let node: Element = card;
  while (node !== document.body && node.parentElement) {
    for (const sibling of node.parentElement.children) {
      if (sibling !== node && !sibling.hasAttribute("inert")) {
        sibling.setAttribute("inert", "");
        inerted.push(sibling);
      }
    }
    node = node.parentElement;
  }
  return () => {
    for (const element of inerted) {
      element.removeAttribute("inert");
    }
  };
}

/**
 * Stops the page from scrolling and closes the root's scrollbar gutters, and
 * returns the undo. The browser's full screen and the immersive card fill
 * the viewport, which an open gutter narrows, leaving strips of the page at
 * its edges. The root takes the gutters' width as padding instead, so the
 * page keeps its layout behind the card.
 */
function lockScroll(root: HTMLElement, padding: GutterPadding) {
  const { style } = root;
  const saved = {
    overflow: style.overflow,
    paddingLeft: style.paddingLeft,
    paddingRight: style.paddingRight,
    scrollbarGutter: style.scrollbarGutter,
  };
  Object.assign(style, {
    ...padding,
    overflow: "hidden",
    scrollbarGutter: "auto",
  });
  return () => {
    Object.assign(style, saved);
  };
}

/**
 * Reads the page around a card while the card is still in it: the card's
 * place, which its slot keeps while the card fills the screen, and the root's
 * scrollbar gutters. It writes nothing, so it lays the page out at most once.
 */
export function measurePage(card: HTMLElement) {
  return {
    padding: measureGutterPadding(document.documentElement),
    place: measurePlace(card),
  };
}

/**
 * Holds the page still behind a card that fills the screen, and returns the
 * release. Everything outside the card turns inert and the page stops
 * scrolling. Scenes in the inert page pause, because a scene that nobody can
 * see or reach needs no frames. It reads no layout, so holding the page at
 * the moment the browser shows the card lays nothing out early.
 */
export function holdPage(card: HTMLElement, padding: GutterPadding) {
  const restoreInert = inertOutside(card);
  const unlockScroll = lockScroll(document.documentElement, padding);
  return () => {
    unlockScroll();
    restoreInert();
  };
}

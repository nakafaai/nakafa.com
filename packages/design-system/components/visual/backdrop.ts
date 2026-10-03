import { Array as Arr, Effect, Option, Schema } from "effect";

/**
 * The space a card takes in the page: its height in pixels and its computed
 * vertical margins, as the style its slot keeps while the card fills the
 * screen.
 */
export const VisualPlaceSchema = Schema.Struct({
  height: Schema.Finite,
  marginBottom: Schema.String,
  marginTop: Schema.String,
});

/** The root's padding that stands in for its scrollbar gutters. */
const VisualPaddingSchema = Schema.Struct({
  paddingLeft: Schema.String,
  paddingRight: Schema.String,
});

/**
 * Measures the card's place in the page. A margin of the card collapses with
 * its neighbours through the slot, and the slot's own margin collapses the
 * same way, so copying it keeps every neighbour where it was.
 */
const measurePlace = Effect.fn("designSystem.visual.measurePlace")(
  (card: HTMLElement) =>
    Effect.sync((): typeof VisualPlaceSchema.Type => {
      const { marginBottom, marginTop } = getComputedStyle(card);
      return {
        height: card.getBoundingClientRect().height,
        marginBottom,
        marginTop,
      };
    })
);

/**
 * Measures the root's padding plus the scrollbar gutter at each side of the
 * viewport. Where scrollbars take space, such as on Windows and Linux, the
 * root keeps its gutters (`scrollbar-gutter: stable`) even while it cannot
 * scroll. Overlay scrollbars, on phones and by default on macOS, take none,
 * and a pinch-zoomed phone can report a viewport narrower than the page.
 */
const measurePadding = Effect.fn("designSystem.visual.measurePadding")(
  (root: HTMLElement) =>
    Effect.sync((): typeof VisualPaddingSchema.Type => {
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
    })
);

/**
 * Reads the backdrop of a card, the page around it, while the card is still in
 * it: the card's place, which its slot keeps while the card fills the screen,
 * and the root's scrollbar gutters. It writes nothing, so it lays the page out
 * at most once.
 */
export const measureBackdrop = Effect.fn("designSystem.visual.measureBackdrop")(
  function* (card: HTMLElement) {
    const padding = yield* measurePadding(document.documentElement);
    const place = yield* measurePlace(card);
    return { padding, place };
  }
);

/**
 * Makes every element outside the card inert, from its siblings up to the
 * children of `body`, until the scope closes. Elements that were already inert
 * stay inert.
 */
const holdInert = Effect.fn("designSystem.visual.holdInert")(
  (card: HTMLElement) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const outside = Arr.flatten(
          Arr.unfold<Element, readonly Element[]>(card, (node) => {
            const parent = node.parentElement;
            return node === document.body || parent === null
              ? Option.none()
              : Option.some([
                  Arr.filter(
                    Arr.fromIterable(parent.children),
                    (sibling) => sibling !== node
                  ),
                  parent,
                ]);
          })
        );
        const inerted = Arr.filter(
          outside,
          (element) => !element.hasAttribute("inert")
        );
        Arr.forEach(inerted, (element) => element.setAttribute("inert", ""));
        return inerted;
      }),
      (inerted) =>
        Effect.sync(() =>
          Arr.forEach(inerted, (element) => element.removeAttribute("inert"))
        )
    )
);

/**
 * Stops the page from scrolling and closes the root's scrollbar gutters until
 * the scope closes. The browser's full screen and the immersive card fill the
 * viewport, which an open gutter narrows, leaving strips of the page at its
 * edges. The root takes the gutters' width as padding instead, so the page
 * keeps its layout behind the card.
 */
const holdScroll = Effect.fn("designSystem.visual.holdScroll")(
  (root: HTMLElement, padding: typeof VisualPaddingSchema.Type) =>
    Effect.acquireRelease(
      Effect.sync(() => {
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
        return saved;
      }),
      (saved) =>
        Effect.sync(() => {
          Object.assign(root.style, saved);
        })
    )
);

/**
 * Holds the backdrop still behind a card that fills the screen until the scope
 * closes. Everything outside the card turns inert and the page stops
 * scrolling. Scenes in the inert page pause, because a scene that nobody can
 * see or reach needs no frames. It reads no layout, so holding the page at
 * the moment the browser shows the card lays nothing out early.
 */
export const holdBackdrop = Effect.fn("designSystem.visual.holdBackdrop")(
  function* (card: HTMLElement, padding: typeof VisualPaddingSchema.Type) {
    yield* holdInert(card);
    yield* holdScroll(document.documentElement, padding);
  }
);

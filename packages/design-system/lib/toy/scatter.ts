import { Array as Arr, Equal, MutableHashMap, Option, Schema } from "effect";

/** Where a toy belongs: its top left corner in the layer, and, if it has one, the side it is drawn at. */
const SpotSchema = Schema.Struct({
  size: Schema.optionalKey(Schema.Finite),
  x: Schema.Finite,
  y: Schema.Finite,
});

/** Where a toy belongs. */
type Spot = typeof SpotSchema.Type;

/** The box of an element in the page, measured from the top left corner of the layer. */
const BoxSchema = Schema.Struct({
  bottom: Schema.Finite,
  height: Schema.Finite,
  left: Schema.Finite,
  right: Schema.Finite,
  top: Schema.Finite,
  width: Schema.Finite,
});

/** The box of an element in the page. */
type Box = typeof BoxSchema.Type;

/**
 * Answers where a toy belongs at this width of the page, from the live layout:
 * `box` measures any element in the page. When there is no free room for the
 * toy at this width it answers nothing, and the toy is left out.
 */
export type Place = (
  width: number,
  box: (el: Element) => Box
) => Option.Option<Spot>;

/**
 * Places toys over a whole page. The layer covers the page, so a toy can be
 * carried from the top of the page to the footer and no section cuts it off.
 * Each toy has a place function that reads the live layout. Places follow the
 * layout when it changes, and a new width is a new page: every toy goes back
 * to where it belongs.
 *
 * Creating the layer touches no page, so it can be created while rendering.
 * `attach` starts it on a layer and returns what stops it.
 */
export function createScatter(rest: (el: HTMLElement) => void) {
  const toys = MutableHashMap.empty<HTMLElement, Place>();
  let layer = Option.none<HTMLElement>();
  let width = 0;
  let frame = 0;

  /** Places every toy, with one pass over the page to read and one to write. */
  function layout() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (Option.isNone(layer)) {
      return;
    }
    const current = layer.value;
    const next = current.clientWidth;
    // The first width is no change of page: nothing has moved yet.
    const fresh = width !== 0 && next !== width;
    width = next;
    const base = current.getBoundingClientRect();
    const box = (el: Element): Box => {
      const rect = el.getBoundingClientRect();
      return {
        bottom: rect.bottom - base.top,
        height: rect.height,
        left: rect.left - base.left,
        right: rect.right - base.left,
        top: rect.top - base.top,
        width: rect.width,
      };
    };
    // Every place is read before any toy is moved: a write between two reads
    // would make the browser lay the page out again for each toy.
    const spots = Arr.map(Arr.fromIterable(toys), ([el, place]) => ({
      el,
      spot: place(next, box),
    }));
    Arr.forEach(spots, ({ el, spot }) => {
      el.hidden = Option.isNone(spot);
      if (Option.isSome(spot)) {
        el.style.left = `${Math.round(spot.value.x)}px`;
        el.style.top = `${Math.round(spot.value.y)}px`;
        if (spot.value.size !== undefined) {
          el.style.setProperty("--toy", `${Math.round(spot.value.size)}px`);
        }
      }
      if (fresh) {
        rest(el);
      }
    });
  }

  /** Asks for a pass at the next frame, once however many changes come. */
  function ask() {
    if (frame === 0 && Option.isSome(layer)) {
      frame = requestAnimationFrame(layout);
    }
  }

  return {
    /** Adds a toy and the function that finds its place. Returns what takes the toy out again. */
    add(el: HTMLElement, place: Place) {
      MutableHashMap.set(toys, Equal.byReferenceUnsafe(el), place);
      ask();
      return () => {
        MutableHashMap.remove(toys, Equal.byReferenceUnsafe(el));
        ask();
      };
    },

    /** Starts placing toys over `layer`. Returns what stops it. */
    attach(over: HTMLElement) {
      layer = Option.some(over);
      const watching = new ResizeObserver(ask);
      watching.observe(over);
      // Text measured before the fonts arrived is placed again once they have.
      document.fonts.ready.then(ask);
      ask();
      return () => {
        watching.disconnect();
        cancelAnimationFrame(frame);
        frame = 0;
        layer = Option.none();
      };
    },

    layout,
  };
}

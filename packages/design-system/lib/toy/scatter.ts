import {
  Array as Arr,
  Equal,
  Match,
  MutableHashMap,
  Number as Num,
  Option,
  Schema,
} from "effect";

/** Where a toy belongs: its top left corner in the layer, and, if it has one, the side it is drawn at. */
const SpotSchema = Schema.Struct({
  size: Schema.optionalKey(Schema.Finite),
  x: Schema.Finite,
  y: Schema.Finite,
});

/** Where a toy belongs. */
type Spot = typeof SpotSchema.Type;

/**
 * What a place answers for a toy: the spot where it belongs, no room for it (`Missing`), or a part of the page that
 * the browser has not drawn yet (`Waiting`), such as a part it skips while it is far from the screen, whose size the
 * page does not know yet. A waiting toy stays as it is: hidden until its first place, or where it was last placed, so
 * a toy never moves while a part far away takes its true size, and a toy a reader carried away never vanishes.
 */
const PlacementSchema = Schema.Union([
  Schema.TaggedStruct("Placed", { spot: SpotSchema }),
  Schema.TaggedStruct("Missing", {}),
  Schema.TaggedStruct("Waiting", {}),
]);

/** What a place answers for a toy. */
type Placement = typeof PlacementSchema.Type;

/** The answer of a place that found where its toy belongs. */
export const placed = (spot: Spot): Placement => ({ _tag: "Placed", spot });

/** The answer of a place that has no room for its toy at this width, or no part to stand beside. */
export const MISSING: Placement = { _tag: "Missing" };

/** The answer of a place whose part the browser has not drawn yet. */
export const WAITING: Placement = { _tag: "Waiting" };

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
 * The event a part with `content-visibility: auto` sends when the browser starts or stops drawing what it holds. It
 * does not bubble, so the layer hears it on the way down.
 */
const DRAWN_CHANGE = "contentvisibilityautostatechange";

/**
 * Where layout put an element, before any transform: its offsets summed up the
 * chain of offset parents, each parent's border included. A part that rises
 * into view by a transform moves on the screen but not in layout, so a toy
 * beside it lands where the part rests, and never jumps when the motion ends
 * and the toys are laid again.
 */
function layoutOrigin(el: HTMLElement): Pick<Box, "left" | "top"> {
  const parent = el.offsetParent;
  if (!(parent instanceof HTMLElement)) {
    return { left: el.offsetLeft, top: el.offsetTop };
  }
  const above = layoutOrigin(parent);
  return {
    left: above.left + parent.clientLeft + el.offsetLeft,
    top: above.top + parent.clientTop + el.offsetTop,
  };
}

/**
 * Answers where a toy belongs at this width of the page, from the live layout:
 * `box` measures any element in the page. When there is no free room for the
 * toy at this width it answers `MISSING`, and the toy is left out; while its part
 * is not drawn yet it answers `WAITING`, and the toy stays as it is.
 */
export type Place = (width: number, box: (el: Element) => Box) => Placement;

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

  /** Places every toy over the layer, with one pass over the page to read and one to write. */
  function lay(current: HTMLElement) {
    frame = 0;
    const next = current.clientWidth;
    // The first width is no change of page: nothing has moved yet.
    const fresh = width !== 0 && next !== width;
    width = next;
    const origin = layoutOrigin(current);
    const base = current.getBoundingClientRect();
    // An element of the page is measured by its layout, so no transform moves
    // its toys; an SVG part has no offsets, so the screen measures it.
    const box = (el: Element): Box => {
      if (el instanceof HTMLElement) {
        const at = layoutOrigin(el);
        const left = at.left - origin.left;
        const top = at.top - origin.top;
        return {
          bottom: top + el.offsetHeight,
          height: el.offsetHeight,
          left,
          right: left + el.offsetWidth,
          top,
          width: el.offsetWidth,
        };
      }
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
      drawn: el.offsetWidth,
      placement: place(next, box),
    }));
    Arr.forEach(spots, ({ drawn, el, placement }) => {
      Match.value(placement).pipe(
        Match.tagsExhaustive({
          Missing: () => {
            el.hidden = true;
          },
          Placed: ({ spot }) => {
            el.hidden = false;
            // A toy never reaches past the layer's right edge, so no place can make
            // the page scroll sideways; a toy wider than the layer starts at its left.
            const wide = spot.size ?? drawn;
            const x = Num.clamp(spot.x, {
              maximum: Num.max(0, next - wide),
              minimum: 0,
            });
            el.style.left = `${Math.round(x)}px`;
            el.style.top = `${Math.round(spot.y)}px`;
            if (spot.size !== undefined) {
              el.style.setProperty("--toy", `${Math.round(spot.size)}px`);
            }
          },
          Waiting: () => undefined,
        })
      );
      if (fresh) {
        rest(el);
      }
    });
  }

  /** Asks for a pass at the next frame, once however many changes come. */
  function ask() {
    if (frame === 0 && Option.isSome(layer)) {
      const current = layer.value;
      frame = requestAnimationFrame(() => lay(current));
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
      // A part the browser starts or stops drawing as it nears or leaves the screen places its waiting toys.
      document.addEventListener(DRAWN_CHANGE, ask, { capture: true });
      ask();
      return () => {
        watching.disconnect();
        document.removeEventListener(DRAWN_CHANGE, ask, { capture: true });
        cancelAnimationFrame(frame);
        frame = 0;
        layer = Option.none();
      };
    },
  };
}

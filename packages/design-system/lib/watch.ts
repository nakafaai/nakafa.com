import { Array as Arr, Option } from "effect";

/** The attribute that marks the face of an animal or of Nina, whose eyes follow the pointer. */
export const LOOK_ATTRIBUTE = "data-look";

const LOOK_SELECTOR = `[${LOOK_ATTRIBUTE}]`;
const CALM = "(prefers-reduced-motion: reduce)";
/** How far, in units of a face's picture, an eye may turn toward the pointer. */
const REACH = 3.2;
/** A pointer this far from a face, in pixels, or further, pulls the eyes all the way. */
const FULL_PULL = 160;
/** Eyes look up and down less than they look sideways. */
const DEPTH = 0.8;
/** The faces count as near the screen from this far outside it. */
const NEAR = "200px";

/**
 * How far the eyes of a face turn toward a pointer, in the units of the face's
 * picture: all the way when the pointer is far, less when it is near, and not
 * at all when it is exactly on the middle of the face.
 */
export function gaze(
  pointer: { x: number; y: number },
  face: { height: number; left: number; top: number; width: number }
) {
  const dx = pointer.x - (face.left + face.width / 2);
  const dy = pointer.y - (face.top + face.height / 2);
  const distance = Math.sqrt(dx * dx + dy * dy);
  const pull = Math.min(1, distance / FULL_PULL) * REACH;
  // A pointer on the middle has no direction, and no pull to give one.
  const along = distance === 0 ? 1 : distance;
  return { x: (dx / along) * pull, y: (dy / along) * pull * DEPTH };
}

/**
 * Turns the eyes of every face inside `element` toward the pointer, with one
 * listener and one frame for the whole group. A face is an `svg` marked with
 * `data-look`; the pull is written to it as `--look-x` and `--look-y`, which
 * the eyes of the face read with the `look` utility. Every face is measured
 * before any is written, so the page lays out once.
 *
 * Nothing listens while the element is far from the screen, because no one
 * can see the eyes, and for a person who asked for less motion nothing follows
 * at all.
 *
 * Returns what stops it.
 */
export function watch(element: HTMLElement) {
  if (window.matchMedia(CALM).matches) {
    return () => undefined;
  }
  // The last place the pointer was seen: a frame is only asked for after it moved.
  const pointer = { x: 0, y: 0 };
  let following = Option.none<AbortController>();
  let frame = 0;

  function aim() {
    frame = 0;
    // A face is looked up when the pointer moves, as faces come and go.
    const faces = Arr.filter(
      Arr.fromIterable(element.querySelectorAll(LOOK_SELECTOR)),
      (face) => face instanceof SVGElement
    );
    const boxes = Arr.map(faces, (face) => face.getBoundingClientRect());
    Arr.forEach(Arr.zip(faces, boxes), ([face, box]) => {
      // A face that is not drawn, because it is hidden, has nothing to turn.
      if (box.width === 0) {
        return;
      }
      const pull = gaze(pointer, box);
      face.style.setProperty("--look-x", pull.x.toFixed(2));
      face.style.setProperty("--look-y", pull.y.toFixed(2));
    });
  }

  function follow() {
    if (Option.isSome(following)) {
      return;
    }
    const listening = new AbortController();
    following = Option.some(listening);
    window.addEventListener(
      "pointermove",
      (event) => {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        if (frame === 0) {
          frame = requestAnimationFrame(aim);
        }
      },
      { passive: true, signal: listening.signal }
    );
  }

  function unfollow() {
    if (Option.isSome(following)) {
      following.value.abort();
      following = Option.none();
    }
    cancelAnimationFrame(frame);
    frame = 0;
  }

  const near = new IntersectionObserver(
    (entries) => {
      Arr.forEach(entries, ({ isIntersecting }) => {
        if (isIntersecting) {
          follow();
        } else {
          unfollow();
        }
      });
    },
    { rootMargin: NEAR }
  );
  near.observe(element);

  return () => {
    near.disconnect();
    unfollow();
  };
}

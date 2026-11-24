import { isCalm } from "@repo/design-system/lib/calm";
import { Array as Arr, Option } from "effect";

/** The attribute that marks the face of an animal or of Nina, whose eyes follow the pointer. */
export const LOOK_ATTRIBUTE = "data-look";

const LOOK_SELECTOR = `[${LOOK_ATTRIBUTE}]`;
const EYE_SELECTOR = ".look";
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
 * `data-look`, and its eyes carry `.look`. Discovered faces and their bounding
 * rects are cached until the DOM, scroll position, or viewport size changes,
 * and `translate` is written straight onto each eye group so static shapes in
 * the SVG pay zero style invalidation.
 *
 * Nothing listens while the element is far from the screen, because no one
 * can see the eyes. For a person who asks for less motion the eyes hold where
 * they are: that is asked each time the pointer moves, because a person can
 * start or stop asking while the page is open.
 *
 * Returns what stops it.
 */
/** Discovers every `[data-look]` SVG face inside `element` along with its bounding box and `.look` eyes. */
function scanFaces(element: HTMLElement) {
  const found = Arr.filter(
    Arr.fromIterable(element.querySelectorAll(LOOK_SELECTOR)),
    (node) => node instanceof SVGElement
  );
  const boxes = Arr.map(found, (face) => face.getBoundingClientRect());
  return Arr.map(Arr.zip(found, boxes), ([face, box]) => ({
    box,
    eyes: Arr.filter(
      Arr.fromIterable(face.querySelectorAll(EYE_SELECTOR)),
      (eye) => eye instanceof SVGElement
    ),
    face,
  }));
}

export function watch(element: HTMLElement) {
  const pointer = { x: 0, y: 0 };
  let following = Option.none<AbortController>();
  let frame = 0;
  let facesDirty = true;
  let boxesDirty = true;
  let cached: ReturnType<typeof scanFaces> = [];

  function refreshFaces() {
    cached = scanFaces(element);
    facesDirty = false;
    boxesDirty = false;
  }

  function refreshBoxes() {
    const boxes = Arr.map(cached, ({ face }) => face.getBoundingClientRect());
    cached = Arr.map(Arr.zip(cached, boxes), ([entry, box]) => ({
      ...entry,
      box,
    }));
    boxesDirty = false;
  }

  function aim() {
    frame = 0;
    if (facesDirty) {
      refreshFaces();
    } else if (boxesDirty) {
      refreshBoxes();
    }
    Arr.forEach(cached, ({ box, eyes }) => {
      if (box.width === 0) {
        return;
      }
      const pull = gaze(pointer, box);
      const value = `${pull.x.toFixed(2)}px ${pull.y.toFixed(2)}px`;
      Arr.forEach(eyes, (eye) => {
        eye.style.translate = value;
      });
    });
  }

  function follow() {
    if (Option.isSome(following)) {
      return;
    }
    facesDirty = true;
    boxesDirty = true;
    const listening = new AbortController();
    following = Option.some(listening);
    window.addEventListener(
      "pointermove",
      (event) => {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        if (frame === 0 && !isCalm()) {
          frame = requestAnimationFrame(aim);
        }
      },
      { passive: true, signal: listening.signal }
    );
    window.addEventListener(
      "scroll",
      () => {
        boxesDirty = true;
      },
      { capture: true, passive: true, signal: listening.signal }
    );
    window.addEventListener(
      "resize",
      () => {
        boxesDirty = true;
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

  const mutations = new MutationObserver(() => {
    facesDirty = true;
    boxesDirty = true;
  });
  mutations.observe(element, { childList: true, subtree: true });

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
    mutations.disconnect();
    near.disconnect();
    unfollow();
  };
}

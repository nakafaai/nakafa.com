import { Option, Schema } from "effect";

/** How long the bar stays shown after the page last moved, in milliseconds, as the ScrollArea bar does. */
const SHOWN_AFTER_SCROLL = 1000;

/** The shortest thumb, in pixels, so a long page keeps a thumb a pointer can take. */
const SHORTEST_THUMB = 32;

/** A drag of the thumb: the pointer that holds it, the page's scroll and the pointer's height when it began. */
const ThumbDrag = Schema.Struct({
  pointer: Schema.Number,
  scroll: Schema.Number,
  start: Schema.Number,
});

/**
 * Wires the page's bar to the window: it places the thumb as the page scrolls or changes height, shows the bar
 * while the page moves, and lets the thumb drag the page and the track jump it. It writes the DOM directly, so a
 * scroll lays out the thumb alone and renders nothing. The returned function unwires it.
 */
function wirePageScrollbar(track: HTMLDivElement) {
  const thumb = track.firstElementChild;
  if (!(thumb instanceof HTMLElement)) {
    return () => undefined;
  }
  const root = document.documentElement;
  let hide = 0;
  let drag = Option.none<typeof ThumbDrag.Type>();

  /** The page's travel, the thumb's length and how far the thumb may move. */
  const measure = () => {
    const view = root.clientHeight;
    const travel = root.scrollHeight - view;
    const length = Math.max((view * view) / root.scrollHeight, SHORTEST_THUMB);
    return { length, room: view - length, travel };
  };

  const place = () => {
    const { length, room, travel } = measure();
    track.hidden = travel <= 0;
    thumb.style.height = `${length}px`;
    thumb.style.transform = `translateY(${travel > 0 ? (root.scrollTop / travel) * room : 0}px)`;
  };

  const onScroll = () => {
    place();
    track.dataset.scrolling = "";
    window.clearTimeout(hide);
    hide = window.setTimeout(() => {
      delete track.dataset.scrolling;
    }, SHOWN_AFTER_SCROLL);
  };

  const onThumbDown = (event: PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    thumb.setPointerCapture(event.pointerId);
    drag = Option.some({
      pointer: event.pointerId,
      scroll: root.scrollTop,
      start: event.clientY,
    });
  };

  const onThumbMove = (event: PointerEvent) =>
    Option.map(
      Option.filter(drag, (held) => held.pointer === event.pointerId),
      (held) => {
        const { room, travel } = measure();
        window.scrollTo({
          behavior: "instant",
          top: held.scroll + ((event.clientY - held.start) * travel) / room,
        });
      }
    );

  const onThumbUp = () => {
    drag = Option.none();
  };

  /** A press on the track brings the thumb's middle under the pointer. */
  const onTrackDown = (event: PointerEvent) => {
    const { length, room, travel } = measure();
    const offset =
      event.clientY - track.getBoundingClientRect().top - length / 2;
    window.scrollTo({
      top: (Math.min(Math.max(offset, 0), room) / room) * travel,
    });
  };

  const resize = new ResizeObserver(place);
  resize.observe(root);
  resize.observe(document.body);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", place);
  thumb.addEventListener("pointerdown", onThumbDown);
  thumb.addEventListener("pointermove", onThumbMove);
  thumb.addEventListener("pointerup", onThumbUp);
  thumb.addEventListener("pointercancel", onThumbUp);
  track.addEventListener("pointerdown", onTrackDown);
  place();

  return () => {
    resize.disconnect();
    window.clearTimeout(hide);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", place);
    thumb.removeEventListener("pointerdown", onThumbDown);
    thumb.removeEventListener("pointermove", onThumbMove);
    thumb.removeEventListener("pointerup", onThumbUp);
    thumb.removeEventListener("pointercancel", onThumbUp);
    track.removeEventListener("pointerdown", onTrackDown);
  };
}

/**
 * The page's own scrollbar. Native bars take no room (globals.css), so the page draws a thin overlay bar at the
 * window's end edge, as the design system's ScrollArea draws one for every other scroller: it shows on hover and
 * while the page moves. A touch screen keeps its own overlay bar, so the page draws none there. Overlays such as
 * sidebars and dialogs stand above it.
 */
export function PageScrollbar() {
  return (
    <div
      aria-hidden="true"
      className="pointer-coarse:hidden fixed inset-e-0 top-0 z-10 flex h-svh w-2.5 touch-none select-none p-0.5 opacity-0 transition-opacity delay-300 hover:opacity-100 hover:delay-0 hover:duration-100 data-scrolling:opacity-100 data-scrolling:delay-0 data-scrolling:duration-100"
      data-slot="page-scrollbar"
      hidden
      ref={wirePageScrollbar}
    >
      <div className="w-full rounded-full bg-muted-foreground" />
    </div>
  );
}

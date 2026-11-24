import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  holdBackdrop,
  measureBackdrop,
} from "@repo/design-system/components/visual/backdrop";
import { elementById } from "@repo/design-system/lib/element";
import { Effect, MutableList } from "effect";

/** The width the test viewport reports, scrollbars included. */
const VIEWPORT_WIDTH = 390;
/** The padding of a page whose scrollbars overlay its content. */
const NO_PADDING = { paddingLeft: "0px", paddingRight: "0px" };
/** A page sitting at its top edge. */
const NO_SCROLL = { x: 0, y: 0 };

/** Builds a page where the card sits two levels below `body`. */
function renderPage() {
  document.body.innerHTML = `
    <header id="header"><button>Outside</button></header>
    <main id="main">
      <p id="before">Before</p>
      <div id="slot">
        <div id="card" style="margin: 16px 0 24px"><button>Inside</button></div>
      </div>
      <aside id="aside" inert>Already inert</aside>
    </main>
    <footer id="footer">Footer</footer>
  `;
  const card = elementById("card");
  if (!card) {
    throw new Error("The test page has no card.");
  }
  vi.spyOn(card, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 120, 370, 480)
  );
  return card;
}

/**
 * Lays the root out between `left` and `right` of a viewport `viewport`
 * pixels wide, the way a pinch-zoomed phone or an open scrollbar narrows it.
 */
function layOutRoot(left: number, right: number, viewport = VIEWPORT_WIDTH) {
  vi.spyOn(window, "innerWidth", "get").mockReturnValue(viewport);
  vi.spyOn(document.documentElement, "getBoundingClientRect").mockReturnValue(
    new DOMRect(left, 0, right - left, 2400)
  );
}

function inertIds() {
  return Array.from(document.querySelectorAll("[inert]"), (node) => node.id);
}

function readRoot() {
  const { overflow, paddingLeft, paddingRight } =
    document.documentElement.style;
  return { overflow, paddingLeft, paddingRight };
}

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("style");
  vi.restoreAllMocks();
});

describe("measuring the page around a visual card", () => {
  it.effect("keeps the card's height and margins for its slot", () =>
    Effect.gen(function* () {
      const card = renderPage();
      layOutRoot(0, VIEWPORT_WIDTH);

      const { place } = yield* measureBackdrop(card);

      expect(place).toEqual({
        height: 480,
        marginBottom: "24px",
        marginTop: "16px",
      });
    })
  );

  it.effect(
    "turns the room at both sides into padding on top of the root's own",
    () =>
      Effect.gen(function* () {
        const card = renderPage();
        layOutRoot(10, 380);
        document.documentElement.style.paddingLeft = "4px";

        const { padding } = yield* measureBackdrop(card);

        expect(padding).toEqual({ paddingLeft: "14px", paddingRight: "10px" });
      })
  );

  it.effect(
    "counts the space of a scrollbar that hiding the overflow removes",
    () =>
      Effect.gen(function* () {
        const card = renderPage();
        // macOS draws a styled scrollbar inside the viewport while it scrolls.
        layOutRoot(0, 380);

        const { padding } = yield* measureBackdrop(card);

        expect(padding).toEqual({ paddingLeft: "0px", paddingRight: "10px" });
      })
  );

  it.effect(
    "counts a root margin as the page's own, not as room at its sides",
    () =>
      Effect.gen(function* () {
        const card = renderPage();
        document.documentElement.style.margin = "0 6px 0 8px";
        layOutRoot(18, 374);

        const { padding } = yield* measureBackdrop(card);

        expect(padding).toEqual({ paddingLeft: "10px", paddingRight: "10px" });
      })
  );

  it.effect(
    "adds no padding where scrollbars overlay a zoomed phone's page",
    () =>
      Effect.gen(function* () {
        const card = renderPage();
        // A pinch-zoomed phone reports half its layout width as the viewport.
        layOutRoot(0, VIEWPORT_WIDTH, VIEWPORT_WIDTH / 2);

        const { padding } = yield* measureBackdrop(card);

        expect(padding).toEqual(NO_PADDING);
      })
  );
});

describe("holding the page behind a visual card", () => {
  it.effect(
    "makes everything outside the card inert and keeps what already was",
    () =>
      Effect.gen(function* () {
        const card = renderPage();

        yield* Effect.scoped(
          Effect.gen(function* () {
            yield* holdBackdrop(card, NO_PADDING, NO_SCROLL);

            expect(inertIds()).toEqual(["header", "before", "aside", "footer"]);
          })
        );

        expect(inertIds()).toEqual(["aside"]);
      })
  );

  it.effect(
    "stops the page scrolling with the room at its sides as padding",
    () =>
      Effect.gen(function* () {
        const card = renderPage();
        document.documentElement.style.overflow = "clip";
        document.documentElement.style.paddingLeft = "4px";

        yield* Effect.scoped(
          Effect.gen(function* () {
            yield* holdBackdrop(
              card,
              {
                paddingLeft: "14px",
                paddingRight: "10px",
              },
              NO_SCROLL
            );

            expect(readRoot()).toEqual({
              overflow: "hidden",
              paddingLeft: "14px",
              paddingRight: "10px",
            });
          })
        );

        expect(readRoot()).toEqual({
          overflow: "clip",
          paddingLeft: "4px",
          paddingRight: "",
        });
      })
  );

  it.effect(
    "restores the page's scroll offset when leaving full screen shifted it",
    () =>
      Effect.gen(function* () {
        const card = renderPage();
        let x = 12;
        let y = 7044;
        const frames = MutableList.make<FrameRequestCallback>();
        const flushFrame = (time: number) => {
          const frame = MutableList.take(frames);
          if (typeof frame === "function") {
            frame(time);
          }
        };
        vi.spyOn(window, "scrollX", "get").mockImplementation(() => x);
        vi.spyOn(window, "scrollY", "get").mockImplementation(() => y);
        vi.spyOn(window, "requestAnimationFrame").mockImplementation(
          (callback) => {
            MutableList.append(frames, callback);
            return 1;
          }
        );
        const scrollTo = vi
          .spyOn(window, "scrollTo")
          .mockImplementation(() => undefined);

        const { padding, scroll } = yield* measureBackdrop(card);

        yield* Effect.scoped(
          Effect.gen(function* () {
            yield* holdBackdrop(card, padding, scroll);
            // A wider full-screen viewport clamped the shorter document's scroll.
            x = 0;
            y = 6647;
          })
        );

        expect(scrollTo).toHaveBeenCalledTimes(1);
        expect(scrollTo).toHaveBeenLastCalledWith({
          behavior: "instant",
          left: 12,
          top: 7044,
        });

        // Two frames later, responsive reflow settles and scroll anchoring shifted `y`.
        y = 7003;
        flushFrame(16);
        flushFrame(32);

        expect(scrollTo).toHaveBeenCalledTimes(2);
        expect(scrollTo).toHaveBeenLastCalledWith({
          behavior: "instant",
          left: 12,
          top: 7044,
        });

        // If the offset was already back in place after reflow, frame two leaves it alone.
        scrollTo.mockClear();
        y = 6647;
        yield* Effect.scoped(holdBackdrop(card, padding, scroll));
        expect(scrollTo).toHaveBeenCalledTimes(1);
        x = 12;
        y = 7044;
        flushFrame(48);
        flushFrame(64);
        expect(scrollTo).toHaveBeenCalledTimes(1);

        // A release where the offset never shifted does not scroll, immediately or after reflow.
        scrollTo.mockClear();
        yield* Effect.scoped(holdBackdrop(card, padding, scroll));
        flushFrame(80);
        flushFrame(96);
        expect(scrollTo).not.toHaveBeenCalled();
      })
  );
});

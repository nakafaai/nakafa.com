import { afterEach, describe, expect, it } from "@effect/vitest";
import { holdPage } from "@repo/design-system/components/visual/page";

/** The width the test viewport reports, scrollbars included. */
const VIEWPORT_WIDTH = 390;

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
  const card = document.getElementById("card");
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
 * pixels wide, the way gutters or an open scrollbar narrow it.
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
  const { overflow, paddingLeft, paddingRight, scrollbarGutter } =
    document.documentElement.style;
  return { overflow, paddingLeft, paddingRight, scrollbarGutter };
}

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("style");
  vi.restoreAllMocks();
});

describe("holding the page behind a visual card", () => {
  it("keeps the card's height and margins for its slot", () => {
    const card = renderPage();
    layOutRoot(0, VIEWPORT_WIDTH);

    const page = holdPage(card);

    expect(page.place).toEqual({
      height: 480,
      marginBottom: "24px",
      marginTop: "16px",
    });
    page.release();
  });

  it("makes everything outside the card inert and keeps what already was", () => {
    const card = renderPage();
    layOutRoot(0, VIEWPORT_WIDTH);

    const page = holdPage(card);

    expect(inertIds()).toEqual(["header", "before", "aside", "footer"]);
    page.release();
    expect(inertIds()).toEqual(["aside"]);
  });

  it("closes both scrollbar gutters into padding so the page keeps its layout", () => {
    const card = renderPage();
    // Windows and Linux reserve `scrollbar-gutter: stable both-edges`.
    layOutRoot(10, 380);
    document.documentElement.style.overflow = "clip";
    document.documentElement.style.paddingLeft = "4px";

    const page = holdPage(card);

    expect(readRoot()).toEqual({
      overflow: "hidden",
      paddingLeft: "14px",
      paddingRight: "10px",
      scrollbarGutter: "auto",
    });
    page.release();
    expect(readRoot()).toEqual({
      overflow: "clip",
      paddingLeft: "4px",
      paddingRight: "",
      scrollbarGutter: "",
    });
  });

  it("closes the space of a scrollbar that hiding the overflow removes", () => {
    const card = renderPage();
    // macOS draws a styled scrollbar inside the viewport while it scrolls.
    layOutRoot(0, 380);

    const page = holdPage(card);

    expect(readRoot()).toMatchObject({
      paddingLeft: "0px",
      paddingRight: "10px",
    });
    page.release();
  });

  it("counts a root margin as the page's own, not as a gutter", () => {
    const card = renderPage();
    document.documentElement.style.margin = "0 6px 0 8px";
    layOutRoot(18, 374);

    const page = holdPage(card);

    expect(readRoot()).toMatchObject({
      paddingLeft: "10px",
      paddingRight: "10px",
    });
    page.release();
  });

  it("adds no padding where scrollbars overlay a zoomed phone's page", () => {
    const card = renderPage();
    // A pinch-zoomed phone reports half its layout width as the viewport.
    layOutRoot(0, VIEWPORT_WIDTH, VIEWPORT_WIDTH / 2);

    const page = holdPage(card);

    expect(readRoot()).toMatchObject({
      overflow: "hidden",
      paddingLeft: "0px",
      paddingRight: "0px",
    });
    page.release();
  });
});

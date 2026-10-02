import { afterEach, describe, expect, it } from "@effect/vitest";
import { createVisualStore } from "@repo/design-system/components/visual/store";
import { Duration, Effect } from "effect";

/** The space the test card takes in the page, as its slot keeps it. */
const CARD_PLACE = { height: 480, marginBottom: "24px", marginTop: "16px" };
/** Every element outside the card, in document order, while it fills the screen. */
const HELD_PAGE = ["header", "before", "aside", "footer"];
/** Stores a test created, so each test ends its own session. */
const stores: ReturnType<typeof createVisualStore>[] = [];

/** Builds a page where the card sits two levels below `body`. */
function renderPage() {
  document.body.innerHTML = `
    <header id="header"><button id="outside">Outside</button></header>
    <main id="main" tabindex="-1">
      <p id="before">Before</p>
      <div id="slot">
        <div id="card" style="margin: 16px 0 24px">
          <button id="inside">Inside</button>
          <button id="trigger">Full screen</button>
        </div>
      </div>
      <aside id="aside" inert>Already inert</aside>
    </main>
    <footer id="footer">Footer</footer>
  `;
  const card = element("card");
  vi.spyOn(card, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 640, CARD_PLACE.height)
  );
  const store = createVisualStore();
  stores.push(store);
  store.getState().bind(card);
  return { card, store, trigger: element("trigger") };
}

function element(id: string) {
  const found = document.getElementById(id);
  if (!found) {
    throw new Error(`The test page has no #${id}.`);
  }
  return found;
}

function inertIds() {
  return Array.from(document.querySelectorAll("[inert]"), (node) => node.id);
}

/** Expects the card back in the page, and the page behind released. */
function expectInline(store: ReturnType<typeof createVisualStore>) {
  expect(store.getState()).toMatchObject({
    place: undefined,
    presentation: "inline",
  });
  expect(inertIds()).toEqual(["aside"]);
}

/**
 * Opens a dialog the way a global shortcut does while the card fills the
 * screen: appended to `body` after the page turned inert.
 */
function openDialogBehind() {
  const dialog = document.createElement("button");
  dialog.id = "dialog";
  document.body.append(dialog);
  return dialog;
}

function pressEscape() {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, key: "Escape" })
  );
}

/**
 * Lets the store's pending browser programs run to their end: one turn of the
 * event loop, after the browser's answers and the store's scheduled work.
 */
const settle = Effect.sleep(Duration.millis(1));

/** Waits until `assertion` holds, as a browser answers in its own time. */
function waitFor(assertion: () => void) {
  return Effect.promise(() => vi.waitFor(assertion));
}

/** A promise whose settlement the test controls. */
function deferred() {
  let resolve: () => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<void>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, reject, resolve };
}

/**
 * Installs the parts of the Fullscreen API the store uses, answering the way
 * a supporting browser does. jsdom implements none of them.
 */
function installFullscreenApi() {
  let fullscreenElement: Element | null = null;
  const change = (next: Element | null) => {
    fullscreenElement = next;
    document.dispatchEvent(new Event("fullscreenchange"));
  };
  const exitFullscreen = vi.fn(async () => {
    await Promise.resolve();
    if (!fullscreenElement) {
      throw new TypeError("The document is not in full screen.");
    }
    change(null);
  });
  Object.defineProperty(document, "fullscreenEnabled", {
    configurable: true,
    value: true,
  });
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    get: () => fullscreenElement,
  });
  Object.defineProperty(document, "exitFullscreen", {
    configurable: true,
    value: exitFullscreen,
  });
  return { change, exitFullscreen };
}

/** Shows the card with the Fullscreen API the way a browser grants it. */
const enterFullscreen = Effect.fn("VisualStoreTest.enterFullscreen")(
  function* () {
    const browser = installFullscreenApi();
    const page = renderPage();
    page.card.requestFullscreen = () => {
      browser.change(page.card);
      return Promise.resolve();
    };
    page.store.getState().enter(page.trigger);
    yield* waitFor(() =>
      expect(page.store.getState().presentation).toBe("fullscreen")
    );
    return { ...page, browser };
  }
);

/** Starts a full screen request the browser answers when the test says. */
function requestPendingFullscreen() {
  const browser = installFullscreenApi();
  const page = renderPage();
  const answer = deferred();
  page.card.requestFullscreen = () => answer.promise;
  page.store.getState().enter(page.trigger);
  return { ...page, answer, browser };
}

afterEach(async () => {
  // An open session keeps its document listeners, which would answer the
  // next test's events. A card in the browser's full screen returns once the
  // browser has left it.
  const ended = stores.splice(0);
  for (const store of ended) {
    store.getState().exit();
  }
  await vi.waitFor(() => {
    for (const store of ended) {
      expect(store.getState().presentation).toBe("inline");
    }
  });
  for (const property of [
    "exitFullscreen",
    "fullscreenElement",
    "fullscreenEnabled",
  ]) {
    Reflect.deleteProperty(document, property);
  }
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("style");
  vi.restoreAllMocks();
});

describe("visual card store without the Fullscreen API", () => {
  it("stays in the page until its card is bound inside the document", () => {
    const { store, trigger } = renderPage();
    store.getState().bind(null);
    store.getState().enter(trigger);
    expectInline(store);

    const detached = document.createElement("div");
    detached.append(trigger);
    store.getState().bind(detached);
    store.getState().enter(trigger);
    expectInline(store);
  });

  it("covers the viewport with the card and holds the page still behind it", () => {
    const { card, store, trigger } = renderPage();

    store.getState().enter(trigger);

    expect(store.getState()).toMatchObject({
      place: CARD_PLACE,
      presentation: "immersive",
    });
    expect(inertIds()).toEqual(HELD_PAGE);
    expect(document.activeElement).toBe(trigger);
    // Without popovers the card stays fixed in the page's own stacking.
    expect(card.hasAttribute("popover")).toBe(false);
  });

  it("lifts the immersive card into the top layer and returns it", () => {
    const { card, store, trigger } = renderPage();
    // jsdom implements no popovers, like Safari before version 17.
    const popover = { hidePopover: vi.fn(), showPopover: vi.fn() };
    Object.assign(card, popover);

    store.getState().enter(trigger);

    expect(store.getState().presentation).toBe("immersive");
    expect(popover.showPopover).toHaveBeenCalledOnce();

    store.getState().exit();

    expect(store.getState().presentation).toBe("inline");
    expect(popover.hidePopover).toHaveBeenCalledOnce();
  });

  it("returns the card, the page, and focus when Escape closes it", () => {
    const { store, trigger } = renderPage();
    store.getState().enter(trigger);
    element("inside").focus();

    pressEscape();

    expectInline(store);
    expect(document.activeElement).toBe(trigger);
  });

  it("holds the page once when it is asked to show the card again", () => {
    const { store, trigger } = renderPage();
    store.getState().enter(trigger);

    store.getState().enter(trigger);

    expect(store.getState().presentation).toBe("immersive");
    expect(inertIds()).toEqual(HELD_PAGE);
    store.getState().exit();
    expectInline(store);
  });

  it("toggles in and out from the card's own action", () => {
    const { store, trigger } = renderPage();

    store.getState().toggle(trigger);
    expect(store.getState().presentation).toBe("immersive");

    store.getState().toggle(trigger);
    expectInline(store);
  });
});

describe("visual card store with the Fullscreen API", () => {
  it.live("shows the card full screen and follows the browser out of it", () =>
    Effect.gen(function* () {
      const browser = installFullscreenApi();
      const { card, store, trigger } = renderPage();
      const requestFullscreen = vi.fn(() => {
        browser.change(card);
        return Promise.resolve();
      });
      card.requestFullscreen = requestFullscreen;

      store.getState().enter(trigger);

      yield* waitFor(() =>
        expect(store.getState().presentation).toBe("fullscreen")
      );
      expect(requestFullscreen).toHaveBeenCalledExactlyOnceWith({
        navigationUI: "hide",
      });
      expect(store.getState().place).toEqual(CARD_PLACE);
      expect(inertIds()).toEqual(HELD_PAGE);
      expect(document.activeElement).toBe(trigger);

      // The browser's own controls leave full screen and report it as an
      // event.
      element("inside").focus();
      browser.change(null);

      expectInline(store);
      expect(document.activeElement).toBe(trigger);
    })
  );

  it.live(
    "holds the page as it was when the card first filled the screen",
    () =>
      Effect.gen(function* () {
        const { browser, card, store } = yield* enterFullscreen();
        // The page changes after it turned inert, and the browser reports the
        // card's full screen again.
        const late = openDialogBehind();

        browser.change(card);

        expect(store.getState().presentation).toBe("fullscreen");
        expect(inertIds()).toEqual(HELD_PAGE);
        expect(late.hasAttribute("inert")).toBe(false);
        browser.change(null);
        expectInline(store);
      })
  );

  it.live("leaves full screen when the page receives Escape", () =>
    Effect.gen(function* () {
      const { browser, store } = yield* enterFullscreen();

      pressEscape();

      yield* waitFor(() =>
        expect(store.getState().presentation).toBe("inline")
      );
      expect(browser.exitFullscreen).toHaveBeenCalledOnce();
      expect(inertIds()).toEqual(["aside"]);
    })
  );

  it.live("leaves full screen when a dialog behind the card takes focus", () =>
    Effect.gen(function* () {
      const { browser, store } = yield* enterFullscreen();

      const dialog = openDialogBehind();
      dialog.focus();

      yield* waitFor(() =>
        expect(store.getState().presentation).toBe("inline")
      );
      expect(browser.exitFullscreen).toHaveBeenCalledOnce();
      expect(document.fullscreenElement).toBeNull();
      expect(document.activeElement).toBe(dialog);
    })
  );

  it.live("leaves full screen from the card's own action", () =>
    Effect.gen(function* () {
      const { browser, store, trigger } = yield* enterFullscreen();

      store.getState().toggle(trigger);

      yield* waitFor(() =>
        expect(store.getState().presentation).toBe("inline")
      );
      expect(browser.exitFullscreen).toHaveBeenCalledOnce();
      expect(inertIds()).toEqual(["aside"]);
    })
  );

  it.live(
    "returns once when a second exit meets a document that already left",
    () =>
      Effect.gen(function* () {
        const { browser, store } = yield* enterFullscreen();
        const removeListener = vi.spyOn(document, "removeEventListener");

        store.getState().exit();
        store.getState().exit();
        yield* settle;

        expect(browser.exitFullscreen).toHaveBeenCalledTimes(2);
        expect(store.getState().presentation).toBe("inline");
        expect(
          removeListener.mock.calls.filter(
            ([type]) => type === "fullscreenchange"
          )
        ).toHaveLength(1);
      })
  );

  it.live(
    "returns the card when the browser refuses to leave full screen",
    () =>
      Effect.gen(function* () {
        const { browser, store } = yield* enterFullscreen();
        browser.exitFullscreen.mockRejectedValueOnce(new TypeError("Refused."));

        store.getState().exit();

        yield* waitFor(() =>
          expect(store.getState().presentation).toBe("inline")
        );
        expect(inertIds()).toEqual(["aside"]);
      })
  );

  it.live("covers the viewport when the browser refuses full screen", () =>
    Effect.gen(function* () {
      installFullscreenApi();
      const { card, store, trigger } = renderPage();
      card.requestFullscreen = () =>
        Promise.reject(new TypeError("Permissions check failed."));

      store.getState().enter(trigger);

      yield* waitFor(() =>
        expect(store.getState().presentation).toBe("immersive")
      );
      expect(inertIds()).toEqual(HELD_PAGE);
      expect(document.activeElement).toBe(trigger);
    })
  );

  it.live("keeps the page usable until the browser shows the card", () =>
    Effect.gen(function* () {
      const { answer, browser, card, store } = requestPendingFullscreen();

      // Another element entering and leaving full screen is not the answer.
      browser.change(element("outside"));
      browser.change(null);

      // The slot keeps the card's place, but a browser that never answers
      // leaves the page as it was.
      expect(store.getState()).toMatchObject({
        place: CARD_PLACE,
        presentation: "inline",
      });
      expect(inertIds()).toEqual(["aside"]);
      expect(document.documentElement.style.overflow).toBe("");

      browser.change(card);
      answer.resolve();

      expect(store.getState().presentation).toBe("fullscreen");
      expect(inertIds()).toEqual(HELD_PAGE);
      expect(document.documentElement.style.overflow).toBe("hidden");
      yield* settle;
      expect(store.getState().presentation).toBe("fullscreen");
      expect(browser.exitFullscreen).not.toHaveBeenCalled();
    })
  );

  it.live(
    "cancels an unanswered request from its action and leaves a late full screen",
    () =>
      Effect.gen(function* () {
        const { answer, browser, card, store, trigger } =
          requestPendingFullscreen();

        store.getState().toggle(trigger);

        expectInline(store);
        browser.change(card);
        answer.resolve();
        yield* waitFor(() => expect(document.fullscreenElement).toBeNull());
        expect(browser.exitFullscreen).toHaveBeenCalledOnce();
        expect(store.getState().presentation).toBe("inline");
      })
  );

  it("cancels an unanswered request with Escape", () => {
    const { store, trigger } = requestPendingFullscreen();

    pressEscape();

    expectInline(store);
    expect(document.activeElement).toBe(trigger);
  });

  it.live("needs nothing more when a late full screen already ended", () =>
    Effect.gen(function* () {
      const { answer, browser, store } = requestPendingFullscreen();
      store.getState().exit();

      answer.resolve();

      yield* waitFor(() =>
        expect(browser.exitFullscreen).toHaveBeenCalledOnce()
      );
      yield* settle;
      expect(store.getState().presentation).toBe("inline");
    })
  );

  it.live(
    "stays in the page when a refusal arrives after the card returned",
    () =>
      Effect.gen(function* () {
        const { answer, store } = requestPendingFullscreen();
        store.getState().exit();

        answer.reject(new TypeError("Refused."));
        yield* settle;

        expectInline(store);
      })
  );
});

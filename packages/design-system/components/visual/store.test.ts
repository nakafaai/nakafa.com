import { afterEach, describe, expect, it } from "@effect/vitest";
import { createVisualStore } from "@repo/design-system/components/visual/store";

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

function pressEscape(target: EventTarget = document, isComposing = false) {
  target.dispatchEvent(
    new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      isComposing,
      key: "Escape",
    })
  );
}

/** Lets the store's pending browser programs settle. */
function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
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
 * Installs the popover methods a browser with a top layer gives the card.
 * jsdom implements none of them, like Safari before version 17.
 */
function installPopover(card: HTMLElement) {
  const showPopover = vi.fn(() => {
    expect(card.getAttribute("popover")).toBe("manual");
  });
  const hidePopover = vi.fn();
  Object.assign(card, { hidePopover, showPopover });
  return { hidePopover, showPopover };
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
async function enterFullscreen() {
  const browser = installFullscreenApi();
  const page = renderPage();
  page.card.requestFullscreen = () => {
    browser.change(page.card);
    return Promise.resolve();
  };
  page.store.getState().enter(page.trigger);
  await vi.waitFor(() =>
    expect(page.store.getState().presentation).toBe("fullscreen")
  );
  return { ...page, browser };
}

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
  // next test's events.
  for (const store of stores.splice(0)) {
    store.getState().exit();
  }
  await settle();
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
    const popover = installPopover(card);

    store.getState().enter(trigger);

    expect(store.getState().presentation).toBe("immersive");
    expect(popover.showPopover).toHaveBeenCalledOnce();

    store.getState().exit();

    expect(store.getState().presentation).toBe("inline");
    expect(popover.hidePopover).toHaveBeenCalledOnce();
    expect(card.hasAttribute("popover")).toBe(false);
  });

  it("keeps focus that is already inside the card", () => {
    const { store, trigger } = renderPage();
    element("inside").focus();

    store.getState().enter(trigger);

    expect(document.activeElement).toBe(element("inside"));
  });

  it("returns the card, the page, and focus when Escape closes it", () => {
    const { store, trigger } = renderPage();
    store.getState().enter(trigger);
    element("inside").focus();

    pressEscape();

    expectInline(store);
    expect(document.activeElement).toBe(trigger);
  });

  it("ignores other keys, an Escape handled inside the card or by an IME, and a second entry", () => {
    const { store, trigger } = renderPage();
    store.getState().enter(trigger);
    element("inside").addEventListener("keydown", (event) =>
      event.preventDefault()
    );

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    pressEscape(element("inside"));
    pressEscape(document, true);
    store.getState().enter(trigger);

    expect(store.getState().presentation).toBe("immersive");
    expect(inertIds()).toEqual(HELD_PAGE);
  });

  it("returns the card when a dialog behind it takes focus", () => {
    const { store, trigger } = renderPage();
    store.getState().enter(trigger);
    element("inside").focus();
    expect(store.getState().presentation).toBe("immersive");

    const dialog = openDialogBehind();
    dialog.focus();

    expectInline(store);
    expect(document.activeElement).toBe(dialog);
  });

  it("stays across the screen when a press on its scene moves focus around it", () => {
    const { store, trigger } = renderPage();
    store.getState().enter(trigger);

    // A press on non-focusable content focuses its nearest focusable
    // ancestor, or drops focus to `body`.
    element("main").focus();
    expect(store.getState().presentation).toBe("immersive");
    trigger.focus();
    trigger.blur();
    expect(document.activeElement).toBe(document.body);
    expect(store.getState().presentation).toBe("immersive");

    pressEscape();

    expect(store.getState().presentation).toBe("inline");
    expect(document.activeElement).toBe(trigger);
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
  it("shows the card full screen and follows the browser out of it", async () => {
    const browser = installFullscreenApi();
    const { card, store, trigger } = renderPage();
    const requestFullscreen = vi.fn(() => {
      browser.change(card);
      return Promise.resolve();
    });
    card.requestFullscreen = requestFullscreen;

    store.getState().enter(trigger);

    await vi.waitFor(() =>
      expect(store.getState().presentation).toBe("fullscreen")
    );
    expect(requestFullscreen).toHaveBeenCalledExactlyOnceWith({
      navigationUI: "hide",
    });
    expect(store.getState().place).toEqual(CARD_PLACE);
    expect(inertIds()).toEqual(HELD_PAGE);
    expect(document.activeElement).toBe(trigger);

    // The browser's own controls leave full screen and report it as an event.
    element("inside").focus();
    browser.change(null);

    expectInline(store);
    expect(document.activeElement).toBe(trigger);
  });

  it("leaves full screen when the page receives Escape", async () => {
    const { browser, store } = await enterFullscreen();

    pressEscape();

    await vi.waitFor(() =>
      expect(store.getState().presentation).toBe("inline")
    );
    expect(browser.exitFullscreen).toHaveBeenCalledOnce();
    expect(inertIds()).toEqual(["aside"]);
  });

  it("leaves full screen when a dialog behind the card takes focus", async () => {
    const { browser, store } = await enterFullscreen();

    const dialog = openDialogBehind();
    dialog.focus();

    await vi.waitFor(() =>
      expect(store.getState().presentation).toBe("inline")
    );
    expect(browser.exitFullscreen).toHaveBeenCalledOnce();
    expect(document.fullscreenElement).toBeNull();
    expect(document.activeElement).toBe(dialog);
  });

  it("leaves full screen from the card's own action", async () => {
    const { browser, store, trigger } = await enterFullscreen();

    store.getState().toggle(trigger);

    await vi.waitFor(() =>
      expect(store.getState().presentation).toBe("inline")
    );
    expect(browser.exitFullscreen).toHaveBeenCalledOnce();
    expect(inertIds()).toEqual(["aside"]);
  });

  it("returns once when a second exit meets a document that already left", async () => {
    const { browser, store } = await enterFullscreen();
    const removeListener = vi.spyOn(document, "removeEventListener");

    store.getState().exit();
    store.getState().exit();
    await settle();

    expect(browser.exitFullscreen).toHaveBeenCalledTimes(2);
    expect(store.getState().presentation).toBe("inline");
    expect(
      removeListener.mock.calls.filter(([type]) => type === "fullscreenchange")
    ).toHaveLength(1);
  });

  it("returns the card when the browser refuses to leave full screen", async () => {
    const { browser, store } = await enterFullscreen();
    browser.exitFullscreen.mockRejectedValueOnce(new TypeError("Refused."));

    store.getState().exit();

    await vi.waitFor(() =>
      expect(store.getState().presentation).toBe("inline")
    );
    expect(inertIds()).toEqual(["aside"]);
  });

  it("covers the viewport when the browser refuses full screen", async () => {
    installFullscreenApi();
    const { card, store, trigger } = renderPage();
    card.requestFullscreen = () =>
      Promise.reject(new TypeError("Permissions check failed."));

    store.getState().enter(trigger);

    await vi.waitFor(() =>
      expect(store.getState().presentation).toBe("immersive")
    );
    expect(inertIds()).toEqual(HELD_PAGE);
    expect(document.activeElement).toBe(trigger);
  });

  it("holds its own request while another element changes full screen", () => {
    const { browser, store } = requestPendingFullscreen();

    browser.change(element("outside"));
    browser.change(null);

    expect(store.getState()).toMatchObject({
      place: CARD_PLACE,
      presentation: "inline",
    });
    expect(inertIds()).toEqual(HELD_PAGE);
  });

  it("cancels an unanswered request from its action and leaves a late full screen", async () => {
    const { answer, browser, card, store, trigger } =
      requestPendingFullscreen();

    store.getState().toggle(trigger);

    expectInline(store);
    browser.change(card);
    answer.resolve();
    await vi.waitFor(() =>
      expect(browser.exitFullscreen).toHaveBeenCalledOnce()
    );
    await settle();
    expect(store.getState().presentation).toBe("inline");
    expect(document.fullscreenElement).toBeNull();
  });

  it("cancels an unanswered request with Escape", () => {
    const { store, trigger } = requestPendingFullscreen();

    pressEscape();

    expectInline(store);
    expect(document.activeElement).toBe(trigger);
  });

  it("needs nothing more when a late full screen already ended", async () => {
    const { answer, browser, store } = requestPendingFullscreen();
    store.getState().exit();

    answer.resolve();

    await vi.waitFor(() =>
      expect(browser.exitFullscreen).toHaveBeenCalledOnce()
    );
    await settle();
    expect(store.getState().presentation).toBe("inline");
  });

  it("stays in the page when a refusal arrives after the card returned", async () => {
    const { answer, store } = requestPendingFullscreen();
    store.getState().exit();

    answer.reject(new TypeError("Refused."));
    await settle();

    expectInline(store);
  });
});

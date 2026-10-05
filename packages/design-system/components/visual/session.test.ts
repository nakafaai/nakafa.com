import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  closeSession,
  focusSession,
  holdSession,
  openSession,
  raiseSession,
  returnFocus,
} from "@repo/design-system/components/visual/session";
import { Effect, Exit } from "effect";

/** The space the test card takes in the page, as its slot keeps it. */
const CARD_PLACE = { height: 480, marginBottom: "24px", marginTop: "16px" };
/** Every element outside the card, in document order, while it fills the screen. */
const HELD_PAGE = ["header", "before", "aside", "footer"];

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
  return { card, trigger: element("trigger") };
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

/** Opens a session on the test page with callbacks the test can read. */
const openTestSession = Effect.fn("VisualSessionTest.open")(function* () {
  const { card, trigger } = renderPage();
  const onExit = vi.fn();
  const onFullscreenChange = vi.fn();
  const session = yield* openSession(card, trigger, onExit, onFullscreenChange);
  return { card, onExit, onFullscreenChange, session, trigger };
});

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("style");
  vi.restoreAllMocks();
});

describe("opening a stay across the screen", () => {
  it.effect("keeps the card's place and listens until it closes", () =>
    Effect.gen(function* () {
      const added = vi.spyOn(document, "addEventListener");
      const removed = vi.spyOn(document, "removeEventListener");
      const { session } = yield* openTestSession();

      expect(session.place).toEqual(CARD_PLACE);
      expect(added.mock.calls.map(([type]) => type)).toEqual([
        "fullscreenchange",
        "keydown",
        "focusin",
      ]);
      expect(removed).not.toHaveBeenCalled();

      yield* closeSession(session);

      // The stay stops listening in the reverse order it started.
      expect(removed.mock.calls.map(([type]) => type)).toEqual([
        "focusin",
        "keydown",
        "fullscreenchange",
      ]);
    })
  );

  it.effect("leaves no listener behind when the browser refuses one", () =>
    Effect.gen(function* () {
      const { card, trigger } = renderPage();
      const addListener = document.addEventListener.bind(document);
      vi.spyOn(document, "addEventListener")
        .mockImplementationOnce(addListener)
        .mockImplementationOnce(() => {
          throw new DOMException("The listener is refused.", "NotAllowedError");
        });
      const removed = vi.spyOn(document, "removeEventListener");

      const exit = yield* Effect.exit(
        openSession(card, trigger, vi.fn(), vi.fn())
      );

      expect(Exit.isFailure(exit)).toBe(true);
      expect(removed.mock.calls.map(([type]) => type)).toEqual([
        "fullscreenchange",
      ]);
    })
  );

  it.effect("reports the browser's own full screen changes", () =>
    Effect.gen(function* () {
      const { onFullscreenChange, session } = yield* openTestSession();

      document.dispatchEvent(new Event("fullscreenchange"));

      expect(onFullscreenChange).toHaveBeenCalledOnce();
      yield* closeSession(session);
      document.dispatchEvent(new Event("fullscreenchange"));
      expect(onFullscreenChange).toHaveBeenCalledOnce();
    })
  );

  it.effect("reports Escape, unless the card or an IME handled it", () =>
    Effect.gen(function* () {
      const { onExit, session } = yield* openTestSession();
      element("inside").addEventListener("keydown", (event) =>
        event.preventDefault()
      );

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      pressEscape(element("inside"));
      pressEscape(document, true);
      expect(onExit).not.toHaveBeenCalled();

      pressEscape();
      expect(onExit).toHaveBeenCalledOnce();
      yield* closeSession(session);
    })
  );

  it.effect("reports focus that leaves the card for another element", () =>
    Effect.gen(function* () {
      const { onExit, session } = yield* openTestSession();

      // A press on non-focusable content focuses its nearest focusable
      // ancestor, or drops focus to `body`.
      element("inside").focus();
      element("main").focus();
      element("trigger").focus();
      element("trigger").blur();
      expect(document.activeElement).toBe(document.body);
      expect(onExit).not.toHaveBeenCalled();

      openDialogBehind().focus();
      expect(onExit).toHaveBeenCalledOnce();
      yield* closeSession(session);
    })
  );
});

describe("a stay across the screen", () => {
  it.effect("holds the page behind the card until the session closes", () =>
    Effect.gen(function* () {
      const { session } = yield* openTestSession();
      expect(inertIds()).toEqual(["aside"]);

      yield* holdSession(session);

      expect(inertIds()).toEqual(HELD_PAGE);
      expect(document.documentElement.style.overflow).toBe("hidden");

      yield* closeSession(session);

      expect(inertIds()).toEqual(["aside"]);
      expect(document.documentElement.style.overflow).toBe("");
    })
  );

  it.effect("lifts the card into the top layer and lowers it again", () =>
    Effect.gen(function* () {
      const { card, session } = yield* openTestSession();
      const popover = installPopover(card);

      yield* raiseSession(session);

      expect(popover.showPopover).toHaveBeenCalledOnce();
      expect(card.getAttribute("popover")).toBe("manual");

      yield* closeSession(session);

      expect(popover.hidePopover).toHaveBeenCalledOnce();
      expect(card.hasAttribute("popover")).toBe(false);
    })
  );

  it.effect("keeps the card fixed in the page where popovers are missing", () =>
    Effect.gen(function* () {
      const { card, session } = yield* openTestSession();

      yield* raiseSession(session);
      yield* closeSession(session);

      expect(card.hasAttribute("popover")).toBe(false);
    })
  );

  it.effect("returns the card to the page before it releases the page", () =>
    Effect.gen(function* () {
      const { card, session } = yield* openTestSession();
      const lowered: string[][] = [];
      Object.assign(card, {
        hidePopover: () => lowered.push(inertIds()),
        showPopover: () => undefined,
      });
      yield* holdSession(session);
      yield* raiseSession(session);

      yield* closeSession(session);

      // The card left the top layer while the page behind was still held.
      expect(lowered).toEqual([HELD_PAGE]);
      expect(inertIds()).toEqual(["aside"]);
    })
  );

  it.effect("releases the page even when lowering the card fails", () =>
    Effect.gen(function* () {
      const { card, session } = yield* openTestSession();
      Object.assign(card, {
        hidePopover: () => {
          throw new DOMException(
            "The card is not showing.",
            "InvalidStateError"
          );
        },
        showPopover: () => undefined,
      });
      yield* holdSession(session);
      yield* raiseSession(session);

      const exit = yield* Effect.exit(closeSession(session));

      expect(Exit.isFailure(exit)).toBe(true);
      expect(inertIds()).toEqual(["aside"]);
      expect(document.documentElement.style.overflow).toBe("");
    })
  );

  it.effect("closes once, however often it is asked to", () =>
    Effect.gen(function* () {
      const removed = vi.spyOn(document, "removeEventListener");
      const { session } = yield* openTestSession();

      yield* closeSession(session);
      yield* closeSession(session);

      expect(removed).toHaveBeenCalledTimes(3);
    })
  );
});

describe("focus across the screen", () => {
  it.effect("moves focus into the card unless it is already there", () =>
    Effect.gen(function* () {
      const { session, trigger } = yield* openTestSession();

      element("inside").focus();
      yield* focusSession(session);
      expect(document.activeElement).toBe(element("inside"));

      element("outside").focus();
      yield* focusSession(session);
      expect(document.activeElement).toBe(trigger);
      yield* closeSession(session);
    })
  );

  it.effect("returns focus to the action unless it moved on", () =>
    Effect.gen(function* () {
      const { session, trigger } = yield* openTestSession();

      element("inside").focus();
      yield* returnFocus(session);
      expect(document.activeElement).toBe(trigger);

      const dialog = openDialogBehind();
      dialog.focus();
      yield* returnFocus(session);
      expect(document.activeElement).toBe(dialog);
      yield* closeSession(session);
    })
  );
});

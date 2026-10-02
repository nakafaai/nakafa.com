import {
  holdPage,
  measurePage,
  type VisualPlace,
} from "@repo/design-system/components/visual/page";
import { Effect, Predicate, Schema } from "effect";
import { createStore } from "zustand";

/** Where a visual card is shown: in the page, or across the whole screen. */
type VisualPresentation = "fullscreen" | "immersive" | "inline";

/** The browser refused to show or leave a visual card with the Fullscreen API. */
class VisualFullscreenError extends Schema.TaggedError<VisualFullscreenError>()(
  "VisualFullscreenError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** One visual card's presentation and the actions that change it. */
export interface VisualState {
  /** Registers the card element; the card passes it as its ref. */
  readonly bind: (card: HTMLElement | null) => void;
  /** Shows the card across the whole screen; focus returns to `trigger`. */
  readonly enter: (trigger: HTMLElement) => void;
  /** Returns the card to its place in the page, or cancels a pending request. */
  readonly exit: () => void;
  /**
   * The card's place in the page from the card's request for the screen until
   * it returns. Its slot keeps it, so nothing behind the card moves.
   */
  readonly place: VisualPlace | undefined;
  /**
   * `fullscreen` is the browser's Fullscreen API. `immersive` covers the
   * viewport with the same element where that API is missing or refused, such
   * as iPhone Safari.
   */
  readonly presentation: VisualPresentation;
  /** Enters the full screen from the card's own action, or leaves it. */
  readonly toggle: (trigger: HTMLElement) => void;
}

/** One stay across the whole screen, from its request to its return. */
interface Session {
  readonly card: HTMLElement;
  /** Holds the page behind the card once the card fills the screen. */
  readonly hold: () => void;
  readonly release: () => void;
  readonly trigger: HTMLElement;
}

/** Puts the card in the browser's top layer, above everything in the page. */
const requestFullscreen = Effect.fn("designSystem.visual.requestFullscreen")(
  function* (card: HTMLElement) {
    yield* Effect.tryPromise({
      try: () => card.requestFullscreen({ navigationUI: "hide" }),
      catch: (cause) =>
        new VisualFullscreenError({
          cause,
          message: "The browser refused to show the visual full screen.",
        }),
    });
  }
);

/** Takes the document out of the browser's full screen. */
const exitFullscreen = Effect.fn("designSystem.visual.exitFullscreen")(
  function* () {
    yield* Effect.tryPromise({
      try: () => document.exitFullscreen(),
      catch: (cause) =>
        new VisualFullscreenError({
          cause,
          message: "The browser could not leave full screen.",
        }),
    });
  }
);

/**
 * Whether focus left the card for another element, such as a dialog. A press
 * on the card's own content, such as its canvas, moves focus to the nearest
 * focusable element around it, which still holds the card.
 */
function hasFocusLeft(card: HTMLElement) {
  const active = document.activeElement;
  return !(active === null || card.contains(active) || active.contains(card));
}

/**
 * Lifts the immersive card into the browser's top layer as a manual popover,
 * so no stacking context or sticky bar of the page can cover it. Browsers
 * without popovers keep the card fixed above the page's own layers.
 */
function raise(card: HTMLElement) {
  if (!Predicate.isFunction(card.showPopover)) {
    return;
  }
  card.setAttribute("popover", "manual");
  card.showPopover();
}

/** Returns a raised card from the top layer to the page. */
function lower(card: HTMLElement) {
  if (!card.hasAttribute("popover")) {
    return;
  }
  card.hidePopover();
  card.removeAttribute("popover");
}

/**
 * Creates the store that shows one visual card across the whole screen.
 *
 * The card element itself changes presentation, so its scene never remounts:
 * a WebGL canvas keeps its context and camera. Its slot keeps the card's
 * place from the request on, and while the card fills the screen the page
 * behind is inert and still. A browser that never answers a request leaves
 * the page as it was. The store follows `fullscreenchange`, because the user
 * can also leave with Escape or the browser's own controls, and it returns the
 * card when focus moves to anything outside it.
 *
 * The actions are the handlers of the card's action, Escape, focus, and
 * `fullscreenchange`, so they run the Fullscreen API programs at that browser
 * event boundary.
 */
export function createVisualStore() {
  let card: HTMLElement | null = null;
  let session: Session | undefined;

  return createStore<VisualState>()((set, get) => {
    /** Moves focus into the card unless it is already there. */
    function focusCard(current: Session) {
      if (!current.card.contains(document.activeElement)) {
        current.trigger.focus({ preventScroll: true });
      }
    }

    /**
     * Returns the card to the page and releases the page. Focus returns to
     * the card's action unless it already moved on to another element.
     */
    function finish(current: Session) {
      if (session !== current) {
        return;
      }
      session = undefined;
      current.release();
      set({ place: undefined, presentation: "inline" });
      if (!hasFocusLeft(current.card)) {
        current.trigger.focus({ preventScroll: true });
      }
    }

    /** Shows the card across the screen and holds the page behind it. */
    function present(
      current: Session,
      presentation: Exclude<VisualPresentation, "inline">
    ) {
      current.hold();
      set({ presentation });
    }

    /** Covers the viewport with the card element itself. */
    function immerse(current: Session) {
      present(current, "immersive");
      raise(current.card);
      focusCard(current);
    }

    /** Follows the Fullscreen API into and out of full screen. */
    function follow(current: Session) {
      if (document.fullscreenElement === current.card) {
        present(current, "fullscreen");
        focusCard(current);
        return;
      }
      if (get().presentation === "fullscreen") {
        finish(current);
      }
    }

    /**
     * Opens a session: the card's slot keeps its place in the page, and the
     * page is measured while the card is still in it.
     */
    function open(element: HTMLElement, trigger: HTMLElement) {
      const onChange = () => follow(current);
      // Browsers usually keep Escape for leaving their own full screen, but
      // the page may receive it too, and the immersive card has no browser
      // full screen at all. Escape also cancels a request the browser has not
      // answered yet. Escape that ends an IME composition stays there.
      const onKeyDown = (event: KeyboardEvent) => {
        if (
          event.key === "Escape" &&
          !(event.defaultPrevented || event.isComposing)
        ) {
          get().exit();
        }
      };
      // A global shortcut can still open a dialog behind the card, which the
      // browser's full screen would hide. Focus that moves there returns the
      // card to the page.
      const onFocusIn = () => {
        if (hasFocusLeft(element)) {
          get().exit();
        }
      };
      const page = measurePage(element);
      let releasePage: () => void = () => undefined;
      set({ place: page.place });
      document.addEventListener("fullscreenchange", onChange);
      document.addEventListener("keydown", onKeyDown);
      document.addEventListener("focusin", onFocusIn);
      const current: Session = {
        card: element,
        hold: () => {
          // Showing the card replaces any earlier hold, so no hold outlives
          // the session.
          releasePage();
          releasePage = holdPage(element, page.padding);
        },
        release: () => {
          document.removeEventListener("focusin", onFocusIn);
          document.removeEventListener("keydown", onKeyDown);
          document.removeEventListener("fullscreenchange", onChange);
          lower(element);
          releasePage();
        },
        trigger,
      };
      return current;
    }

    /** Requests the Fullscreen API, or covers the viewport when it refuses. */
    function request(current: Session) {
      return requestFullscreen(current.card).pipe(
        // The card can return while the browser is still entering full
        // screen. A document that already left needs nothing more.
        Effect.andThen(() =>
          session === current
            ? Effect.void
            : exitFullscreen().pipe(
                Effect.catchTag("VisualFullscreenError", () => Effect.void)
              )
        ),
        Effect.catchTag("VisualFullscreenError", () =>
          Effect.sync(() => {
            if (session === current) {
              immerse(current);
            }
          })
        )
      );
    }

    return {
      bind: (element) => {
        card = element;
      },
      enter: (trigger) => {
        if (!card?.isConnected || session) {
          return;
        }
        const current = open(card, trigger);
        session = current;
        if (document.fullscreenEnabled) {
          Effect.runFork(request(current));
          return;
        }
        immerse(current);
      },
      exit: () => {
        const current = session;
        if (!current) {
          return;
        }
        // A pending request returns at once; its late full screen is left
        // again when the browser grants it.
        if (document.fullscreenElement !== current.card) {
          finish(current);
          return;
        }
        Effect.runFork(
          exitFullscreen().pipe(
            // Only a document outside full screen refuses to leave it.
            Effect.catchTag("VisualFullscreenError", () =>
              Effect.sync(() => finish(current))
            )
          )
        );
      },
      place: undefined,
      presentation: "inline",
      toggle: (trigger) => {
        // A request the browser has not answered yet holds the session, so
        // the action can also cancel it.
        if (session) {
          get().exit();
          return;
        }
        get().enter(trigger);
      },
    };
  });
}

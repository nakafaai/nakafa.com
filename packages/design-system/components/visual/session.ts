import {
  holdBackdrop,
  measureBackdrop,
} from "@repo/design-system/components/visual/backdrop";
import { Effect, Exit, Predicate, Scope } from "effect";

/**
 * Whether focus left the card for another element, such as a dialog. A press
 * on the card's own content, such as its canvas, moves focus to the nearest
 * focusable element around it, which still holds the card.
 */
function hasFocusLeft(card: HTMLElement) {
  const active = document.activeElement;
  return !(active === null || card.contains(active) || active.contains(card));
}

/** Listens to the document until the scope closes. */
function listen<Type extends keyof DocumentEventMap>(
  type: Type,
  listener: (event: DocumentEventMap[Type]) => void
) {
  return Effect.acquireRelease(
    Effect.sync(() => document.addEventListener(type, listener)),
    () => Effect.sync(() => document.removeEventListener(type, listener))
  );
}

/**
 * Opens one stay across the whole screen, from the card's request to its
 * return. It measures the page while the card is still in it and listens for
 * the ways a learner leaves: the browser's own full screen controls, which
 * report `fullscreenchange`, Escape, and focus that moves outside the card.
 *
 * Everything the stay takes from the page belongs to its scope, so closing the
 * session returns the card and the page as they were, in the reverse order the
 * stay took them.
 */
export const openSession = Effect.fn("designSystem.visual.openSession")(
  function* (
    card: HTMLElement,
    trigger: HTMLElement,
    onExit: () => void,
    onFullscreenChange: () => void
  ) {
    const scope = yield* Scope.make();
    const { padding, place } = yield* measureBackdrop(card);
    yield* Effect.all(
      [
        listen("fullscreenchange", onFullscreenChange),
        // Browsers usually keep Escape for leaving their own full screen, but
        // the page may receive it too, and the immersive card has no browser
        // full screen at all. Escape also cancels a request the browser has
        // not answered yet. Escape that ends an IME composition stays there.
        listen("keydown", (event) => {
          if (
            event.key === "Escape" &&
            !(event.defaultPrevented || event.isComposing)
          ) {
            onExit();
          }
        }),
        // A global shortcut can still open a dialog behind the card, which
        // the browser's full screen would hide. Focus that moves there
        // returns the card to the page.
        listen("focusin", () => {
          if (hasFocusLeft(card)) {
            onExit();
          }
        }),
      ],
      { discard: true }
    ).pipe(
      Scope.provide(scope),
      // A listener the browser refuses leaves none of the others behind.
      Effect.onError(() => Scope.close(scope, Exit.void))
    );
    return { card, padding, place, scope, trigger };
  }
);

/** One stay across the whole screen, from its request to its return. */
export type Session = Effect.Success<ReturnType<typeof openSession>>;

/**
 * Holds the page behind the card once the card fills the screen, until the
 * session closes.
 */
export const holdSession = Effect.fn("designSystem.visual.holdSession")(
  ({ card, padding, scope }: Session) =>
    holdBackdrop(card, padding).pipe(Scope.provide(scope))
);

/**
 * Lifts the immersive card into the browser's top layer as a manual popover,
 * so no stacking context or sticky bar of the page can cover it, until the
 * session closes. Browsers without popovers keep the card fixed above the
 * page's own layers.
 */
export const raiseSession = Effect.fn("designSystem.visual.raiseSession")(
  function* ({ card, scope }: Session) {
    if (!Predicate.isFunction(card.showPopover)) {
      return;
    }
    yield* Effect.acquireRelease(
      Effect.sync(() => {
        card.setAttribute("popover", "manual");
        card.showPopover();
      }),
      () =>
        Effect.sync(() => {
          card.hidePopover();
          card.removeAttribute("popover");
        })
    ).pipe(Scope.provide(scope));
  }
);

/** Moves focus into the card unless it is already there. */
export const focusSession = Effect.fn("designSystem.visual.focusSession")(
  ({ card, trigger }: Session) =>
    Effect.sync(() => {
      if (!card.contains(document.activeElement)) {
        trigger.focus({ preventScroll: true });
      }
    })
);

/**
 * Returns focus to the card's action unless it already moved on to another
 * element.
 */
export const returnFocus = Effect.fn("designSystem.visual.returnFocus")(
  ({ card, trigger }: Session) =>
    Effect.sync(() => {
      if (!hasFocusLeft(card)) {
        trigger.focus({ preventScroll: true });
      }
    })
);

/**
 * Returns the card and the page as they were: lowers the card, releases the
 * page, and stops listening.
 */
export const closeSession = Effect.fn("designSystem.visual.closeSession")(
  ({ scope }: Session) => Scope.close(scope, Exit.void)
);

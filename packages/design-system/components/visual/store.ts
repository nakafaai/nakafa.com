import { VisualPlaceSchema } from "@repo/design-system/components/visual/backdrop";
import {
  closeSession,
  focusSession,
  holdSession,
  openSession,
  raiseSession,
  returnFocus,
  type Session,
} from "@repo/design-system/components/visual/session";
import { Effect, Schema } from "effect";
import { createStore, type ExtractState } from "zustand";
import { combine } from "zustand/middleware";

/**
 * Where a visual card is shown. `fullscreen` is the browser's Fullscreen API.
 * `immersive` covers the viewport with the same element where that API is
 * missing or refused, such as iPhone Safari.
 */
const VisualPresentationSchema = Schema.Literals([
  "fullscreen",
  "immersive",
  "inline",
]);

/**
 * What the card's parts read: where the card is shown, and its place in the
 * page from its request for the screen until it returns. Its slot keeps that
 * place, so nothing behind the card moves.
 */
const VisualViewSchema = Schema.Struct({
  place: Schema.UndefinedOr(VisualPlaceSchema),
  presentation: VisualPresentationSchema,
});

/** A card shown in its place in the page. */
const INLINE: typeof VisualViewSchema.Type = {
  place: undefined,
  presentation: "inline",
};

/** The browser refused to show or leave a visual card with the Fullscreen API. */
class VisualFullscreenError extends Schema.TaggedError<VisualFullscreenError>()(
  "VisualFullscreenError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

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
 * `fullscreenchange`, so they run the session and Fullscreen API programs at
 * that browser event boundary.
 */
export function createVisualStore() {
  return createStore(
    combine(INLINE, (set, get) => {
      let card: HTMLElement | null = null;
      let session: Session | undefined;

      /**
       * Returns the card to the page and releases the page. Focus returns to
       * the card's action unless it already moved on to another element.
       */
      function finish(current: Session) {
        if (session !== current) {
          return;
        }
        session = undefined;
        Effect.runSync(closeSession(current));
        set(INLINE);
        Effect.runSync(returnFocus(current));
      }

      /**
       * Shows the card across the screen and holds the page behind it, once
       * for the whole stay.
       */
      function present(
        current: Session,
        presentation: Exclude<typeof VisualPresentationSchema.Type, "inline">
      ) {
        if (get().presentation === "inline") {
          Effect.runSync(holdSession(current));
        }
        set({ presentation });
      }

      /** Covers the viewport with the card element itself. */
      function immerse(current: Session) {
        present(current, "immersive");
        Effect.runSync(
          raiseSession(current).pipe(Effect.andThen(focusSession(current)))
        );
      }

      /** Follows the Fullscreen API into and out of full screen. */
      function follow(current: Session) {
        if (document.fullscreenElement === current.card) {
          present(current, "fullscreen");
          Effect.runSync(focusSession(current));
          return;
        }
        if (get().presentation === "fullscreen") {
          finish(current);
        }
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

      /** Shows the card across the whole screen; focus returns to `trigger`. */
      function enter(trigger: HTMLElement) {
        if (!card?.isConnected || session) {
          return;
        }
        const current = Effect.runSync(
          openSession(card, trigger, exit, () => follow(current))
        );
        session = current;
        set({ place: current.place });
        if (document.fullscreenEnabled) {
          Effect.runFork(request(current));
          return;
        }
        immerse(current);
      }

      /** Returns the card to its place in the page, or cancels a pending request. */
      function exit() {
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
      }

      return {
        /** Registers the card element; the card passes it as its ref. */
        bind: (element: HTMLElement | null) => {
          card = element;
        },
        enter,
        exit,
        /** Enters the full screen from the card's own action, or leaves it. */
        toggle: (trigger: HTMLElement) => {
          // A request the browser has not answered yet holds the session, so
          // the action can also cancel it.
          if (session) {
            exit();
            return;
          }
          enter(trigger);
        },
      };
    })
  );
}

/** One visual card's store, which its card creates and its parts share. */
export type VisualStore = ReturnType<typeof createVisualStore>;

/** One visual card's presentation and the actions that change it. */
export type VisualState = ExtractState<VisualStore>;

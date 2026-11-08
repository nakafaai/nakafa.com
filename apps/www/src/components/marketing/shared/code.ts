import { PRESSED_ATTRIBUTE } from "@repo/design-system/hooks/press";
import { Deferred, Effect, Exit, Option } from "effect";
import type { ComponentType } from "react";

/**
 * The code of one section under the first screen. The page's HTML already holds
 * the section, so its JavaScript is left out of the page's first load: it loads
 * when the section nears the screen, and a client navigation loads it before the
 * page commits. The component is kept here once it has loaded, so a later render
 * reads it at once and never suspends.
 */
export interface LaterCode<Props extends object> {
  component: Option.Option<ComponentType<Props>>;
  readonly load: () => Promise<ComponentType<Props>>;
  loading: Option.Option<Promise<ComponentType<Props>>>;
  readonly near: Deferred.Deferred<void>;
  waiting: Option.Option<Promise<ComponentType<Props>>>;
}

/** Declares the code of a section, which starts to load only when it is opened. */
export function laterCode<Props extends object>(
  load: () => Promise<ComponentType<Props>>
): LaterCode<Props> {
  return {
    component: Option.none(),
    load,
    loading: Option.none(),
    near: Deferred.makeUnsafe(),
    waiting: Option.none(),
  };
}

/** The one promise of a section's code, which waits until the section is opened. */
function readLoading<Props extends object>(code: LaterCode<Props>) {
  return Option.getOrElse(code.loading, () => {
    const loading = Deferred.await(code.near).pipe(
      Effect.andThen(Effect.promise(code.load)),
      Effect.tap((component) =>
        Effect.sync(() => {
          code.component = Option.some(component);
        })
      ),
      Effect.runPromise
    );
    code.loading = Option.some(loading);
    return loading;
  });
}

/**
 * The code as a boundary waits for it. Code that fails to load leaves the boundary
 * waiting, so the section stays the server's HTML, whose links still work, and
 * the failure never reaches the page's error page.
 */
export function readWaiting<Props extends object>(code: LaterCode<Props>) {
  return Option.getOrElse(code.waiting, () => {
    const waiting = Effect.tryPromise(() => readLoading(code)).pipe(
      Effect.catchTag("UnknownError", () => Effect.never),
      Effect.runPromise
    );
    code.waiting = Option.some(waiting);
    return waiting;
  });
}

/** Lets a section's code load, and answers once it has. */
export function openLaterCode<Props extends object>(code: LaterCode<Props>) {
  Deferred.doneUnsafe(code.near, Exit.void);
  return readLoading(code);
}

/**
 * Whether the reader pressed a control of the section before React took the page
 * over. The pre-paint script marks that control, and React replays the press once
 * the section mounts (`useMissedPress`). A browser lets a press open a file picker
 * only for a few seconds after it, so such a section opens at once instead of
 * waiting for the page to settle.
 */
export function holdsEarlyPress(box: ParentNode) {
  return box.querySelector(`[${PRESSED_ATTRIBUTE}]`) !== null;
}

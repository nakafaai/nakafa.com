import type { ReactNode } from "react";

/**
 * The box the whole app renders in, once at its root. It is at least as tall as the screen, and it clips what
 * overflows its width, so a wide element never lets a phone scroll the page sideways. Unlike hidden, clipping
 * makes no scroll container, so sticky headers still stick.
 *
 * A signed-in screen and a school page render only in the browser, so their first HTML holds no page and
 * the stage stands empty until the scripts arrive. On a slow phone that is seconds of a blank screen, so
 * an empty stage draws Nakafa's mark over a loader in pure CSS, which needs no script. It shows only after
 * 400 ms, so a fast page never flashes it, and it goes by itself with the first element React draws.
 */
export function AppStage({ children }: { children: ReactNode }) {
  return (
    <div
      className="empty:after:border-muted-foreground min-h-svh overflow-x-clip empty:before:fixed empty:before:inset-0 empty:before:m-auto empty:before:size-12 empty:before:-translate-y-5 empty:before:rounded-xl empty:before:bg-[url(/logo.svg)] empty:before:bg-contain empty:before:transition-opacity empty:before:delay-400 empty:before:content-[''] empty:after:fixed empty:after:inset-0 empty:after:m-auto empty:after:size-6 empty:after:translate-y-8 empty:after:animate-spin empty:after:rounded-full empty:after:border-2 empty:after:border-t-transparent empty:after:transition-opacity empty:after:delay-400 starting:empty:before:opacity-0 starting:empty:after:opacity-0"
      data-slot="app-stage"
    >
      {children}
    </div>
  );
}

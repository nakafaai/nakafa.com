import { lazyRouteComponent, useSearch } from "@tanstack/react-router";
import { type ComponentProps, Suspense } from "react";
import { PRACTICE_SEARCH } from "@/components/tryout/route/path";

/** The practice's code, which reaches the player, KaTeX and the Markdown reader. */
const LazyTryoutPractice = lazyRouteComponent(
  () => import("@/components/tryout/practice/page"),
  "TryoutPractice"
);

/**
 * The practice of one section. A set or a section opened as a try-out never reads its code, so the player and
 * the readers it brings stay out of the page's first JavaScript (ADR 0039), and the page holds no invented
 * practice while it loads.
 */
export function TryoutPractice(
  props: ComponentProps<typeof LazyTryoutPractice>
) {
  return (
    <Suspense fallback={null}>
      <LazyTryoutPractice {...props} />
    </Suspense>
  );
}

const LazyTryoutPracticeSession = lazyRouteComponent(
  () => import("@/components/tryout/practice/page"),
  "TryoutPracticeSession"
);

/** The practice's player, from the same code. It stands inside the practice, whose boundary waits for both. */
export function TryoutPracticeSession(
  props: ComponentProps<typeof LazyTryoutPracticeSession>
) {
  return <LazyTryoutPracticeSession {...props} />;
}

/** Whether the page's address opens its practice in place of its try-out (ADR 0044). */
export function useTryoutPracticing() {
  return useSearch({
    select: (search) => search.mode === PRACTICE_SEARCH.mode,
    strict: false,
  });
}

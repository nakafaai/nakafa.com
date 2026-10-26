import { wholeHeight } from "@repo/design-system/components/nina/height";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import type { ReactNode } from "react";
import { NINA_SIZE } from "@/components/state/size";

/**
 * The arrangement of every full-page state, whether something is missing or
 * something broke: the design system's empty state, without its frame, because
 * the page has none. Nina doing the one thing that fits is its media, the title
 * is the page's `h1`, one sentence is its description, and the ways on are its
 * content.
 *
 * Nothing in it can make the page scroll sideways: a word wider than the
 * window breaks, a long label wraps inside its button, and her place clips what
 * is wider than the page leaves her, so a window narrower than she is shows
 * her cut at the sides.
 *
 * Her place has its final height before she is drawn, so a late figure moves
 * nothing. A figure that cannot be drawn leaves its place empty and the words
 * and actions stay, because this page may be the last that works.
 */
export function Screen({ children }: { children: ReactNode }) {
  return <Empty className="wrap-anywhere w-full p-0 md:p-0">{children}</Empty>;
}

/** The figure, the title, and the description of a full-page state. */
export function ScreenHeader({ children }: { children: ReactNode }) {
  return <EmptyHeader className="w-full">{children}</EmptyHeader>;
}

/** Nina in what she does, and what lies beside her, in a place of her final height. */
export function ScreenFigure({ children }: { children: ReactNode }) {
  return (
    <EmptyMedia
      className="w-full overflow-x-clip"
      style={{ height: wholeHeight(NINA_SIZE) }}
    >
      <ErrorBoundary fallback={null}>{children}</ErrorBoundary>
    </EmptyMedia>
  );
}

/** The heading the page composes, which is the page's `h1`. */
export function ScreenTitle({ children }: { children: ReactNode }) {
  return <EmptyTitle className="text-2xl sm:text-3xl">{children}</EmptyTitle>;
}

/** One sentence, with no blame. */
export function ScreenDescription({ children }: { children: ReactNode }) {
  return (
    <EmptyDescription className="max-w-[34ch] text-base">
      {children}
    </EmptyDescription>
  );
}

/** The ways on: one main action and one quiet one. */
export function ScreenActions({ children }: { children: ReactNode }) {
  return (
    <EmptyContent className="max-w-xs items-stretch gap-2 *:h-auto *:whitespace-normal sm:w-auto sm:max-w-none sm:flex-row">
      {children}
    </EmptyContent>
  );
}

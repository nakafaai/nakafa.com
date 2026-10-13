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

interface ScreenProps {
  /** The ways on: one main action and one quiet one. */
  actions: ReactNode;
  /** One sentence, with no blame. */
  description: string;
  /** Nina in what she does, and what lies beside her. */
  figure: ReactNode;
  title: string;
}

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
export function Screen({ actions, description, figure, title }: ScreenProps) {
  return (
    <Empty className="wrap-anywhere w-full p-0 md:p-0">
      <EmptyHeader className="w-full">
        <EmptyMedia
          className="w-full overflow-x-clip"
          style={{ height: wholeHeight(NINA_SIZE) }}
        >
          <ErrorBoundary fallback={null}>{figure}</ErrorBoundary>
        </EmptyMedia>
        <EmptyTitle className="text-2xl sm:text-3xl">
          <h1>{title}</h1>
        </EmptyTitle>
        <EmptyDescription className="max-w-[34ch] text-base">
          {description}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="max-w-xs items-stretch gap-2 *:h-auto *:whitespace-normal sm:w-auto sm:max-w-none sm:flex-row">
        {actions}
      </EmptyContent>
    </Empty>
  );
}

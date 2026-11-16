import { Array as Arr } from "effect";
import { type ReactNode, useEffect, useRef } from "react";
import { useTranslations } from "use-intl";
import type { PlayerCellModel } from "@/components/player/model";
import { keepVisible } from "@/components/player/navigator/scroll";
import { PlayerTools } from "@/components/player/navigator/tools";
import { usePlayer } from "@/components/player/provider";
import { PaneBody, PaneHeader } from "@/components/shared/page/pane";

/**
 * The player's pane beside the questions from the large breakpoint, the same for every paper: its header, which
 * counts the answered questions under its title while a paper runs (`PlayerNavigatorHeader`); the paper's parts as a
 * picker, when it has more than one (`PlayerParts`); the card of the time left or the score; the numbers; and the
 * footer with the accessibility info and the view (`PlayerTools`). It is a column as wide as its pane that stays
 * under the header while the questions scroll, and scrolls by itself to keep the current number in view. The page
 * never moves for it. Below the large breakpoint the same parts open in the sheet (`PlayerSheet`).
 */
export function PlayerSidebar({
  children,
  footer,
  header,
}: {
  /** From the top: the paper's parts (`PlayerParts`), the card of the time left or the score, then the numbers. */
  children: ReactNode;
  /** What the paper adds to the footer, such as a result's one action. */
  footer?: ReactNode;
  /** The pane's header: the navigator's while a paper runs (`PlayerNavigatorHeader`), a result's own after. */
  header: ReactNode;
}) {
  const current = usePlayer((state) => state.current);
  const column = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cell = column.current?.querySelector<HTMLElement>(
      '[aria-current="step"]'
    );
    if (!(column.current && cell) || current === null) {
      return;
    }
    column.current.scrollTop = keepVisible({
      bottom: cell.offsetTop + cell.offsetHeight,
      height: column.current.clientHeight,
      scrollTop: column.current.scrollTop,
      top: cell.offsetTop,
    });
  }, [current]);

  return (
    // The pane holds the column, with the header, body and footer every pane has. Its body scrolls under an
    // overlay bar that takes no room, and its viewport is what keeps the current number in view.
    <div
      className="hidden h-full min-h-0 w-full min-w-0 flex-col lg:flex"
      data-player-sidebar=""
    >
      {header}
      <PaneBody viewportRef={column}>
        <div className="flex flex-col gap-4">{children}</div>
      </PaneBody>
      <PlayerTools>{footer}</PlayerTools>
    </div>
  );
}

/** The navigator's header while a paper runs: its name, and how many of the paper's questions are answered. */
export function PlayerNavigatorHeader({
  questions,
}: {
  questions: readonly PlayerCellModel[];
}) {
  const t = useTranslations("Player");
  return (
    <PaneHeader
      description={t("navigator-answered", {
        answered: Arr.filter(questions, (question) => question.answered).length,
        total: questions.length,
      })}
      title={t("navigator")}
    />
  );
}

import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  GridViewIcon,
  TaskDone01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Option } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { readNeighbor, readPosition } from "@/components/player/order";
import { usePlayer } from "@/components/player/provider";

/**
 * The controls under the questions in one row: previous at the start, the middle controls (the flag, and the
 * navigator opener below the large breakpoint) in the centre, and next at the end. The three zones
 * keep their places whatever the labels say, so nothing moves when next becomes review. It sticks to the
 * bottom of the screen, so a learner moves on without scrolling back. The list measures it through
 * `data-player-footer`, so the end of the list counts as reached once it clears the footer.
 */
export function PlayerFooter({ children }: { children?: ReactNode }) {
  const t = useTranslations("Player");

  return (
    <footer
      className="sticky bottom-0 z-10 border-t bg-background pb-[env(safe-area-inset-bottom,0px)]"
      data-player-footer=""
    >
      <fieldset className="mx-auto grid h-16 w-full min-w-0 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2 border-0 px-4 sm:px-6">
        <legend className="sr-only">{t("controls")}</legend>
        <div className="flex justify-start">
          <PlayerPrevious />
        </div>
        <div className="flex items-center gap-2">{children}</div>
        <div className="flex justify-end">
          <PlayerNext />
        </div>
      </fieldset>
    </footer>
  );
}

/** Goes to the question before the current one; disabled on the first. */
function PlayerPrevious() {
  const t = useTranslations("Player");
  const tCommon = useTranslations("Common");
  const available = usePlayer((state) =>
    Option.isSome(readNeighbor(state.keys, state.current, -1))
  );
  const step = usePlayer((state) => state.step);

  return (
    <Button
      aria-keyshortcuts="ArrowLeft"
      aria-label={t("previous-question")}
      disabled={!available}
      onClick={() => step(-1)}
      type="button"
      variant="outline"
    >
      <HugeIcons icon={ArrowLeft01Icon} />
      <span className="hidden sm:inline">{tCommon("previous")}</span>
    </Button>
  );
}

/**
 * Goes to the question after the current one. On the last question it becomes review, which opens the
 * finish's review of the flagged and the unanswered questions, so the end of the questions leads on.
 */
function PlayerNext() {
  const t = useTranslations("Player");
  const tCommon = useTranslations("Common");
  const last = usePlayer(
    (state) =>
      state.current !== null &&
      Option.isNone(readNeighbor(state.keys, state.current, 1))
  );
  const step = usePlayer((state) => state.step);
  const open = usePlayer((state) => state.open);

  if (last) {
    return (
      <Button
        aria-haspopup="dialog"
        onClick={() => open("finish")}
        type="button"
        variant="outline"
      >
        <span className="max-sm:sr-only">{t("review")}</span>
        <HugeIcons icon={TaskDone01Icon} />
      </Button>
    );
  }

  return (
    <Button
      aria-keyshortcuts="ArrowRight"
      aria-label={t("next-question")}
      onClick={() => step(1)}
      type="button"
      variant="outline"
    >
      <span className="hidden sm:inline">{tCommon("next")}</span>
      <HugeIcons icon={ArrowRight01Icon} />
    </Button>
  );
}

/**
 * Opens the navigator sheet below the large breakpoint, where the sidebar is not on screen, and shows where
 * the learner is, such as 4/30, because no other part of the screen shows the count there. The current
 * number carries `data-player-position`, so a check reads it apart from the count.
 */
export function PlayerOpener() {
  const t = useTranslations("Player");
  const number = usePlayer((state) => readPosition(state.keys, state.current));
  const total = usePlayer((state) => state.keys.length);
  const open = usePlayer((state) => state.open);

  return (
    <Button
      aria-haspopup="dialog"
      aria-keyshortcuts="G"
      aria-label={t("navigator-open", { number })}
      className="font-mono tabular-nums lg:hidden"
      onClick={() => open("navigator")}
      type="button"
      variant="outline"
    >
      <HugeIcons icon={GridViewIcon} />
      <span>
        <span data-player-position="">{number}</span>
        <span className="text-muted-foreground">/{total}</span>
      </span>
    </Button>
  );
}

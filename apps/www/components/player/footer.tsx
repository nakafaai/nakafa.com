"use client";

import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  GridViewIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Option } from "effect";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { readNeighbor, readPosition } from "@/components/player/order";
import { usePlayer } from "@/components/player/provider";

/**
 * The controls under the questions: previous, a middle control such as the navigator opener on small
 * screens, and next. It sticks to the bottom of the screen, so a learner moves on without scrolling back.
 * The list measures it through `data-player-footer`, so the end of the list counts as reached once it
 * clears the footer.
 */
export function PlayerFooter({ children }: { children?: ReactNode }) {
  const t = useTranslations("Player");

  return (
    <footer
      className="sticky bottom-0 z-10 border-t bg-background pb-[env(safe-area-inset-bottom,0px)]"
      data-player-footer=""
    >
      <fieldset className="mx-auto flex h-16 w-full min-w-0 max-w-3xl items-center justify-between gap-2 border-0 px-6 lg:max-w-5xl">
        <legend className="sr-only">{t("controls")}</legend>
        <PlayerPrevious />
        {children}
        <PlayerNext />
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

/** Goes to the question after the current one; disabled on the last. */
function PlayerNext() {
  const t = useTranslations("Player");
  const tCommon = useTranslations("Common");
  const available = usePlayer((state) =>
    Option.isSome(readNeighbor(state.keys, state.current, 1))
  );
  const step = usePlayer((state) => state.step);

  return (
    <Button
      aria-keyshortcuts="ArrowRight"
      aria-label={t("next-question")}
      disabled={!available}
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
 * Opens the navigator sheet on the number of the current question; the sidebar replaces it from the large
 * breakpoint. A screen that puts it in its header passes no footer child.
 */
export function PlayerOpener() {
  const t = useTranslations("Player");
  const number = usePlayer((state) => readPosition(state.keys, state.current));
  const open = usePlayer((state) => state.open);

  return (
    <Button
      aria-haspopup="dialog"
      aria-keyshortcuts="G"
      aria-label={t("navigator-open", { number })}
      className="min-w-16 font-mono tabular-nums lg:hidden"
      onClick={() => open("navigator")}
      type="button"
      variant="outline"
    >
      <HugeIcons icon={GridViewIcon} />
      {number}
    </Button>
  );
}

"use client";

import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Flag01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import { usePlayer, usePlayerView } from "@/components/player/context";
import { focusPlayerSidebar } from "@/components/player/navigator/focus";
import { PLAYER_SHEET_ID } from "@/components/player/navigator/sheet";

/**
 * The sticky question controls: previous, flag, position, next. While the
 * player is mounted, the page's scroll padding keeps focused fields clear of
 * the header and this footer.
 */
export function PlayerFooter() {
  const t = useTranslations("Player");
  return (
    <footer className="sticky bottom-0 z-10 border-t bg-background pb-[env(safe-area-inset-bottom,0px)] [html:has(&)]:scroll-pt-20 [html:has(&)]:scroll-pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      <fieldset className="mx-auto flex h-16 w-full min-w-0 max-w-3xl items-center justify-between gap-2 border-0 px-6 lg:max-w-5xl">
        <legend className="sr-only">{t("controls")}</legend>
        <PlayerStep delta={-1} />
        <div className="flex items-center gap-2">
          <PlayerFlag />
          <PlayerPosition />
        </div>
        <PlayerStep delta={1} />
      </fieldset>
    </footer>
  );
}

/** Moves one question back or forward; disabled at either end. */
function PlayerStep({ delta }: { readonly delta: -1 | 1 }) {
  const t = useTranslations("Player");
  const keys = usePlayerView((view) => view.keys);
  const current = usePlayerView((view) => view.current);
  const step = usePlayerView((view) => view.step);
  const index = current === null ? -1 : keys.indexOf(current);
  const target = keys[index + delta];
  const back = delta === -1;
  return (
    <Button
      aria-keyshortcuts={back ? "ArrowLeft" : "ArrowRight"}
      aria-label={t(back ? "previous-question" : "next-question")}
      disabled={index === -1 || target === undefined}
      onClick={() => step(delta)}
      type="button"
      variant="outline"
    >
      {back ? <HugeIcons icon={ArrowLeft01Icon} /> : null}
      <span className="hidden sm:inline">{t(back ? "previous" : "next")}</span>
      {back ? null : <HugeIcons icon={ArrowRight01Icon} />}
    </Button>
  );
}

/** Flags the current question; both labels share one cell, so it never resizes. */
function PlayerFlag() {
  const t = useTranslations("Player");
  const current = usePlayerView((view) => view.current);
  const locked = usePlayer((session) => session.state.locked);
  const question = usePlayer((session) =>
    session.state.questions.find((candidate) => candidate.key === current)
  );
  if (!question) {
    return null;
  }
  return (
    <Button
      aria-keyshortcuts="F"
      aria-label={t("flag-question", { number: question.number })}
      aria-pressed={question.flagged}
      disabled={locked}
      onClick={() => question.flag(!question.flagged)}
      type="button"
      variant={question.flagged ? "secondary" : "outline"}
    >
      <HugeIcons icon={Flag01Icon} />
      <span className="grid">
        <span
          className="col-start-1 row-start-1 data-[hidden=true]:invisible"
          data-hidden={question.flagged}
        >
          {t("flag")}
        </span>
        <span
          className="col-start-1 row-start-1 data-[hidden=true]:invisible"
          data-hidden={!question.flagged}
        >
          {t("flagged")}
        </span>
      </span>
    </Button>
  );
}

/**
 * Shows the position. Below the large breakpoint it opens the navigator
 * sheet; from it, it moves focus to the sidebar grid.
 */
function PlayerPosition() {
  const t = useTranslations("Player");
  const keys = usePlayerView((view) => view.keys);
  const current = usePlayerView((view) => view.current);
  const open = usePlayerView((view) => view.open);
  const overlay = usePlayerView((view) => view.overlay);
  const position = current === null ? 0 : keys.indexOf(current) + 1;
  const label = `${position} / ${keys.length}`;
  const width = { minWidth: `${String(keys.length).length * 2 + 3}ch` };
  return (
    <>
      <Button
        aria-controls={PLAYER_SHEET_ID}
        aria-expanded={overlay === "navigator"}
        aria-haspopup="dialog"
        aria-keyshortcuts="G"
        aria-label={t("navigator-open", {
          current: position,
          total: keys.length,
        })}
        className="font-mono tabular-nums lg:hidden"
        onClick={() => open("navigator")}
        style={width}
        type="button"
        variant="outline"
      >
        {label}
      </Button>
      <Button
        aria-keyshortcuts="G"
        aria-label={t("navigator-focus", {
          current: position,
          total: keys.length,
        })}
        className="hidden font-mono tabular-nums lg:inline-flex"
        onClick={focusPlayerSidebar}
        style={width}
        type="button"
        variant="outline"
      >
        {label}
      </Button>
    </>
  );
}

"use client";

import {
  ArrowLeft01Icon,
  BookOpen01Icon,
  PickaxeIcon,
  Redo02Icon,
  Undo02Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cva } from "class-variance-authority";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { IslandBook } from "@/components/island/book";
import { BlockIcon } from "@/components/island/icon";
import { panelVariants } from "@/components/island/panel";
import { useGame } from "@/components/island/store";

/** One square of the hotbar or the HUD's buttons, lit when it is held. */
const slotVariants = cva(
  "relative grid size-9 shrink-0 place-items-center border-2 p-1 transition-transform outline-none active:translate-y-px sm:size-12 sm:p-1.5",
  {
    defaultVariants: { held: false, screen: "every" },
    variants: {
      /** Slots 7 to 9 only fit a wide screen; a phone keeps six blocks at hand. */
      screen: { every: "", wide: "max-sm:hidden" },
      held: {
        false:
          "border-[#7a4a26] bg-[#e9c992] hover:bg-[#f0d6a6] focus-visible:border-[#fff3c4]",
        true: "-translate-y-1 border-[#fff3c4] bg-[#ffe9a8] shadow-[0_0_0_2px_#4a2c17]",
      },
    },
  }
);

/** A square HUD button with its icon and its name, which a screen reader reads. */
function HudButton({
  children,
  held = false,
  label,
  onPress,
  screen = "every",
}: {
  children: ReactNode;
  held?: boolean;
  label: string;
  onPress: () => void;
  screen?: "every" | "wide";
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={held}
      className={slotVariants({ held, screen })}
      onClick={onPress}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

/** The hotbar: nine blocks, the pickaxe and the block book, along the bottom of the screen. */
function Hotbar() {
  const t = useTranslations("Island");
  const hotbar = useGame((state) => state.hotbar);
  const slot = useGame((state) => state.slot);
  const tool = useGame((state) => state.tool);
  const choose = useGame((state) => state.choose);
  const setTool = useGame((state) => state.setTool);
  const setBook = useGame((state) => state.setBook);
  return (
    <nav
      aria-label={t("hotbar")}
      className={panelVariants({
        className:
          "pointer-events-auto flex max-w-full gap-1 overflow-x-auto p-1.5 [scrollbar-width:none]",
      })}
    >
      {Arr.map(
        Arr.makeBy(hotbar.length, (number) => number),
        (number) => (
          <HudButton
            held={tool === "place" && slot === number}
            key={number}
            label={t(`block-${hotbar[number]}`)}
            onPress={() => choose(number)}
            screen={number < 6 ? "every" : "wide"}
          >
            <BlockIcon block={hotbar[number]} />
            <span className="absolute top-0 left-0.5 font-mono text-[10px] leading-none text-[#7a4a26]">
              {number + 1}
            </span>
          </HudButton>
        )
      )}
      <HudButton
        held={tool === "remove"}
        label={t("pickaxe")}
        onPress={() => setTool("remove")}
      >
        <HugeIcons className="size-6" icon={PickaxeIcon} />
      </HudButton>
      <HudButton label={t("book")} onPress={() => setBook(true)}>
        <HugeIcons className="size-6" icon={BookOpen01Icon} />
      </HudButton>
    </nav>
  );
}

/** Undo and redo, which walk the learner's own steps. */
function History() {
  const t = useTranslations("Island");
  const undo = useGame((state) => state.undo);
  const redo = useGame((state) => state.redo);
  return (
    <div
      className={panelVariants({
        className: "pointer-events-auto flex gap-1 p-1.5",
      })}
    >
      <HudButton label={t("undo")} onPress={undo}>
        <HugeIcons className="size-5" icon={Undo02Icon} />
      </HudButton>
      <HudButton label={t("redo")} onPress={redo}>
        <HugeIcons className="size-5" icon={Redo02Icon} />
      </HudButton>
    </div>
  );
}

/**
 * The island's name, its level, and how far the learner's Stars have come
 * toward the next level (ADR 0047, D7), as a pixel bar.
 */
function Progress() {
  const t = useTranslations("Island");
  const level = useGame((state) => state.level);
  const { from, lifetime, next } = useGame((state) => state.progress);
  const share = next === undefined ? 1 : (lifetime - from) / (next - from);
  return (
    <div className="flex min-w-32 flex-col gap-1 pr-1">
      <h1 className="flex items-baseline justify-between gap-2 text-sm font-semibold">
        {t("title")}
        <span className="text-xs text-[#7a4a26]">{t("level", { level })}</span>
      </h1>
      <div className="h-2 border border-[#4a2c17] bg-[#e9c992]">
        <div
          className="h-full bg-[#e6b93a] shadow-[inset_0_-2px_0_#c6911f]"
          style={{
            width: `${Math.round(Math.min(1, Math.max(0, share)) * 100)}%`,
          }}
        />
      </div>
      <p className="text-[10px] leading-tight text-[#6b4426]">
        {next === undefined
          ? t("top")
          : t("next", { level: level + 1, stars: next - lifetime })}
      </p>
    </div>
  );
}

/** How long a notice stays before it fades. */
const NOTICE_MS = 4000;

/** A note about the server, in the game's own frame at the top of the screen, gone after a few seconds. */
function Notice() {
  const t = useTranslations("Island");
  const notice = useGame((state) => state.notice);
  const setNotice = useGame((state) => state.setNotice);
  return notice === null ? null : (
    <p
      className={panelVariants({
        className:
          "pointer-events-auto mx-auto max-w-sm px-3 py-2 text-center text-sm",
      })}
      ref={(node) => {
        if (node === null) {
          return;
        }
        const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);
        return () => window.clearTimeout(timer);
      }}
      role="status"
    >
      {t(`notice-${notice}`)}
    </p>
  );
}

/**
 * The HUD over the world (ADR 0047, D5 and D7): the way out and the island's
 * name at the top left, undo and redo at the top right, and the hotbar at the
 * bottom. It lets every press it does not take fall through to the world.
 */
export function IslandHud() {
  const t = useTranslations("Island");
  const book = useGame((state) => state.book);
  const leave = useGame((state) => state.leave);
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col gap-2 p-[max(0.75rem,env(safe-area-inset-top))_max(0.75rem,env(safe-area-inset-right))_max(0.75rem,env(safe-area-inset-bottom))_max(0.75rem,env(safe-area-inset-left))]">
      <header className="flex items-start justify-between gap-3">
        <div
          className={panelVariants({
            className: "pointer-events-auto flex items-center gap-2 p-1.5 pr-3",
          })}
        >
          <HudButton label={t("leave")} onPress={leave}>
            <HugeIcons className="size-5" icon={ArrowLeft01Icon} />
          </HudButton>
          <Progress />
        </div>
        <History />
      </header>
      <Notice />
      <footer className="mt-auto flex justify-center">
        <Hotbar />
      </footer>
      {book ? <IslandBook /> : null}
    </div>
  );
}

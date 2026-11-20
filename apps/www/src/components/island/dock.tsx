"use client";

import {
  BookOpen01Icon,
  Hammer01Icon,
  MountainIcon,
  Navigation03Icon,
  PawPrintIcon,
  Share08Icon,
  StickerIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Separator } from "@repo/design-system/components/ui/separator";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Link } from "@tanstack/react-router";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { panelVariants } from "@/components/island/panel";
import type { Mode, Sheet } from "@/components/island/store";
import { useGame } from "@/components/island/store";
import { HudTile, HudTileLabel, tileVariants } from "@/components/island/tile";
import { useCurrentLocale } from "@/lib/routing/link";

/** The icon of each mode. */
const MODE_ICONS = {
  brush: MountainIcon,
  build: Hammer01Icon,
  explore: Navigation03Icon,
} as const;

/**
 * The dock's row of tiles. Seven tiles of 44 px do not fit the narrowest
 * phones, so the learner's own dock stands in two rows under 360 px, with
 * Learn at their end for the height of both; a visitor's five fit one row on
 * every screen.
 */
const dockVariants = cva(
  "sideways:col-start-2 col-start-1 row-start-5 mt-2 flex max-w-full items-stretch gap-0.5 p-1 max-sm:w-full sm:gap-1",
  {
    variants: {
      visiting: {
        false: "max-[22.5rem]:grid max-[22.5rem]:grid-cols-4",
        true: "",
      },
    },
  }
);

/**
 * A tile of the dock: as wide as its label needs on a phone, where seven
 * share the screen's width, never under 44 px, and never narrower than its
 * neighbours on a wider screen.
 */
const dockTileVariants = cva(
  "min-w-11 flex-auto max-sm:text-[0.625rem] sm:min-w-16 sm:px-2 sm:has-[>svg]:px-2",
  {
    defaultVariants: { ending: false },
    variants: {
      /** Learn, which ends the two rows of the narrowest phones for the height of both. */
      ending: {
        false: "",
        true: "max-[22.5rem]:col-start-4 max-[22.5rem]:row-span-2 max-[22.5rem]:row-start-1 max-[22.5rem]:h-auto",
      },
    },
  }
);

/** The line between the dock's groups, which the two rows of the narrowest phones do without. */
const dockRuleVariants = cva("my-1", {
  variants: { visiting: { false: "max-[22.5rem]:hidden", true: "" } },
});

/** One of the three things the learner's hands do, pressed while it is the mode. */
function ModeTile({ mode }: { mode: Mode }) {
  const t = useTranslations("Island");
  const held = useGame((state) => state.mode === mode);
  const setMode = useGame((state) => state.setMode);
  return (
    <HudTile
      aria-pressed={held}
      className={dockTileVariants()}
      onClick={() => setMode(mode)}
      variant="ghost"
    >
      <HugeIcons icon={MODE_ICONS[mode]} />
      <HudTileLabel>{t(`mode-${mode}`)}</HudTileLabel>
    </HudTile>
  );
}

/** A tile that opens one of the HUD's sheets over the world. */
function SheetTile({ children, sheet }: { children: ReactNode; sheet: Sheet }) {
  const setSheet = useGame((state) => state.setSheet);
  return (
    <HudTile
      aria-haspopup="dialog"
      className={dockTileVariants()}
      onClick={() => setSheet(sheet)}
      variant="ghost"
    >
      {children}
    </HudTile>
  );
}

/** The way from the game to learning, where Stars come from: the one primary of the screen. */
function LearnTile() {
  const t = useTranslations("Common");
  const locale = useCurrentLocale();
  const visiting = useGame((state) => state.host !== null);
  return (
    <Link
      className={cn(
        buttonVariants({ variant: "default" }),
        tileVariants(),
        dockTileVariants({ ending: !visiting })
      )}
      params={{ locale }}
      to="/$locale/home"
    >
      <HugeIcons icon={BookOpen01Icon} />
      <HudTileLabel>{t("learn")}</HudTileLabel>
    </Link>
  );
}

/**
 * The dock at the bottom of the screen (ADR 0050, W7): Explore, Build and
 * Landscape, then Animals, Class and Share, then Learn. In someone else's
 * world nothing is built, so the modes that build are gone and Share gives
 * way to leaving a sticker (W6).
 */
export function IslandDock() {
  const t = useTranslations("Island");
  const tCommon = useTranslations("Common");
  const visiting = useGame((state) => state.host !== null);
  return (
    <nav
      aria-label={t("tools")}
      className={panelVariants({ className: dockVariants({ visiting }) })}
    >
      <ModeTile mode="explore" />
      {visiting ? null : (
        <>
          <ModeTile mode="build" />
          <ModeTile mode="brush" />
        </>
      )}
      <Separator
        className={dockRuleVariants({ visiting })}
        orientation="vertical"
      />
      <SheetTile sheet="animals">
        <HugeIcons icon={PawPrintIcon} />
        <HudTileLabel>{t("animals")}</HudTileLabel>
      </SheetTile>
      <SheetTile sheet="class">
        <HugeIcons icon={UserGroupIcon} />
        <HudTileLabel>{tCommon("class")}</HudTileLabel>
      </SheetTile>
      {visiting ? (
        <SheetTile sheet="guests">
          <HugeIcons icon={StickerIcon} />
          <HudTileLabel>{t("sticker")}</HudTileLabel>
        </SheetTile>
      ) : (
        <SheetTile sheet="share">
          <HugeIcons icon={Share08Icon} />
          <HudTileLabel>{tCommon("share")}</HudTileLabel>
        </SheetTile>
      )}
      <Separator
        className={dockRuleVariants({ visiting })}
        orientation="vertical"
      />
      <LearnTile />
    </nav>
  );
}

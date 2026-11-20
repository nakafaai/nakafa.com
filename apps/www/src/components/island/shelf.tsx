"use client";

import {
  DropletIcon,
  House03Icon,
  LanternIcon,
  Redo02Icon,
  RotateClockwiseIcon,
  StarIcon,
  Tree02Icon,
  Undo02Icon,
} from "@hugeicons/core-free-icons";
import type { Shelf } from "@repo/backend/confect/island/things";
import {
  isOpen,
  priceOf,
  THINGS,
  Thing,
} from "@repo/backend/confect/island/things";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cva } from "class-variance-authority";
import { Array as Arr } from "effect";
import { useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { BlueprintDialog } from "@/components/island/blueprint";
import { ThingIcon } from "@/components/island/icon";
import { panelVariants } from "@/components/island/panel";
import { useGame } from "@/components/island/store";
import { HudTile, HudTileLabel } from "@/components/island/tile";
import { Brush } from "@/lib/island/land/stroke";
import { swatchOf } from "@/lib/island/sketch";

/** The icon of each shelf's tab. */
const SHELF_ICONS = {
  building: House03Icon,
  decor: LanternIcon,
  nature: Tree02Icon,
  water: DropletIcon,
} as const;

/** The shelves in the order their tabs stand. */
const SHELVES = ["nature", "building", "decor", "water"] as const;

/**
 * The shelf in its three layouts (ADR 0050, W7): over the dock on an upright
 * phone, a tray 820 px wide over it on a wider screen, with its footer beside
 * its header once there is room, and at the left for the screen's whole
 * height on a phone held sideways, where the brushes need less than that.
 */
const shelfVariants = cva(
  "sideways:col-start-1 sideways:row-span-full sideways:row-start-1 sideways:mt-0 sideways:mr-2 sideways:flex sideways:w-77 sideways:flex-col col-start-1 row-start-4 mt-2 grid w-full max-w-205 grid-cols-1 gap-2 p-2 lg:grid-cols-[minmax(0,1fr)_auto]",
  {
    variants: {
      mode: { brush: "sideways:self-end", build: "sideways:self-stretch" },
    },
  }
);

/** A thing's tile: its picture over its name in a row of tiles, or beside its name where the shelf stands at the left. */
const cardVariants = cva(
  "aria-pressed:border-foreground aria-pressed:ring-foreground sideways:h-13 sideways:w-full sideways:flex-row sideways:items-center relative h-auto w-32 flex-col items-stretch gap-0 overflow-hidden p-0 whitespace-normal aria-pressed:ring-1"
);

/** The ground a thing's picture stands on, dimmed until its blueprint is open, and lower on a short phone, where the shelf leaves the game's lines their room. */
const wellVariants = cva(
  "bg-muted short:h-20 sideways:h-full sideways:w-16 sideways:shrink-0 block h-30 p-1",
  { variants: { open: { false: "*:opacity-60 *:grayscale", true: "" } } }
);

/** One tab of the build shelf, pressed while its shelf shows. */
function ShelfTab({ shelf }: { shelf: typeof Shelf.Type }) {
  const t = useTranslations("Island");
  const shown = useGame((state) => state.shelf === shelf);
  const setShelf = useGame((state) => state.setShelf);
  return (
    <HudTile
      aria-pressed={shown}
      ground="soft"
      onClick={() => setShelf(shelf)}
      variant="ghost"
    >
      <HugeIcons icon={SHELF_ICONS[shelf]} />
      <HudTileLabel>{t(`shelf-${shelf}`)}</HudTileLabel>
    </HudTile>
  );
}

/**
 * One thing of the shelf (ADR 0050, W2 and W5): its picture, its name, and
 * its price in Stars until its blueprint is open. A press holds an open
 * thing for the next press on the land, a second press lets go of it, and a
 * press on a locked one opens its blueprint.
 */
function ThingCard({ kind }: { kind: Thing }) {
  const t = useTranslations("Island");
  const format = useFormatter();
  const open = useGame((state) => isOpen(kind, state.blueprints));
  const held = useGame((state) => state.item === kind);
  const hold = useGame((state) => state.hold);
  const [asking, setAsking] = useState(false);
  return (
    <li className="sideways:shrink flex shrink-0">
      <Button
        aria-pressed={held}
        className={cardVariants()}
        onClick={() => {
          if (open) {
            hold(held ? null : kind);
            return;
          }
          setAsking(true);
        }}
        variant="outline"
      >
        <span className={wellVariants({ open })}>
          <ThingIcon kind={kind} />
        </span>
        <span className="sideways:flex-1 truncate px-2 py-1.5 text-start text-xs font-medium">
          {t(`thing-${kind}`)}
        </span>
        {open ? null : (
          <span className="bg-card text-card-foreground sideways:static sideways:mr-2 absolute top-1 right-1 flex items-center gap-0.5 rounded-sm border px-1 text-xs tabular-nums">
            <HugeIcons icon={StarIcon} size="xs" />
            <span aria-hidden="true">{format.number(priceOf(kind))}</span>
            <span className="sr-only">
              {t("stars", { stars: format.number(priceOf(kind)) })}
            </span>
          </span>
        )}
      </Button>
      <BlueprintDialog kind={kind} open={asking} setOpen={setAsking} />
    </li>
  );
}

/** The things of the shelf that shows, side by side in a row that scrolls, or one under the other where the shelf stands at the left. */
function ThingList() {
  const t = useTranslations("Island");
  const shelf = useGame((state) => state.shelf);
  return (
    <ul
      aria-label={t(`shelf-${shelf}`)}
      className="sideways:h-full sideways:touch-pan-y sideways:flex-col sideways:overflow-x-hidden sideways:overflow-y-auto -m-1 flex touch-pan-x [scrollbar-width:none] gap-2 overflow-x-auto overscroll-contain p-1"
    >
      {Arr.map(
        Arr.filter(Thing.literals, (kind) => THINGS[kind].shelf === shelf),
        (kind) => (
          <ThingCard key={kind} kind={kind} />
        )
      )}
    </ul>
  );
}

/** One brush with the tone it lays, pressed while it is in hand. */
function BrushTile({ brush }: { brush: Brush }) {
  const t = useTranslations("Island");
  const held = useGame((state) => state.brush === brush);
  const setBrush = useGame((state) => state.setBrush);
  return (
    <HudTile
      aria-pressed={held}
      ground="soft"
      onClick={() => setBrush(brush)}
      variant="ghost"
    >
      <span
        className="ring-foreground/15 size-4 shrink-0 rounded-sm ring-1 ring-inset"
        style={{ backgroundColor: swatchOf(brush) }}
      />
      <HudTileLabel>{t(`brush-${brush}`)}</HudTileLabel>
    </HudTile>
  );
}

/**
 * The shelf's footer: Undo and Redo, which walk the learner's own steps, and
 * on the build shelf Turn, which shows the quarter turns the next thing is
 * set down with.
 */
function ShelfActions() {
  const t = useTranslations("Island");
  const tCommon = useTranslations("Common");
  const building = useGame((state) => state.mode === "build");
  const steps = useGame((state) => state.past.length);
  const undone = useGame((state) => state.future.length);
  const turn = useGame((state) => state.turn);
  const undo = useGame((state) => state.undo);
  const redo = useGame((state) => state.redo);
  const turnHand = useGame((state) => state.turnHand);
  return (
    <footer className="lg:col-start-2 lg:row-start-1">
      <fieldset
        aria-label={t("steps")}
        className="sideways:auto-cols-fr grid auto-cols-fr grid-flow-col gap-2 lg:auto-cols-[5.5rem]"
      >
        <HudTile disabled={steps === 0} onClick={undo} variant="outline">
          <HugeIcons icon={Undo02Icon} />
          <HudTileLabel>{tCommon("undo")}</HudTileLabel>
        </HudTile>
        <HudTile disabled={undone === 0} onClick={redo} variant="outline">
          <HugeIcons icon={Redo02Icon} />
          <HudTileLabel>{tCommon("redo")}</HudTileLabel>
        </HudTile>
        {building ? (
          <HudTile onClick={turnHand} variant="outline">
            <HugeIcons
              className="transition-[rotate] duration-200 ease-out motion-reduce:transition-none"
              icon={RotateClockwiseIcon}
              style={{ rotate: `${turn * 90}deg` }}
            />
            <HudTileLabel>{t("turn", { degrees: turn * 90 })}</HudTileLabel>
          </HudTile>
        ) : null}
      </fieldset>
    </footer>
  );
}

/**
 * The shelf the building modes show (ADR 0050, W7), read as header, body and
 * footer on every screen: in Build the four tabs of kinds, the things of the
 * one that shows, then Undo, Redo and Turn; in Landscape its name, the nine
 * brushes, then Undo and Redo.
 */
export function IslandShelf() {
  const t = useTranslations("Island");
  const mode = useGame((state) => (state.mode === "brush" ? "brush" : "build"));
  return (
    <section
      aria-label={t(`mode-${mode}`)}
      className={panelVariants({ className: shelfVariants({ mode }) })}
    >
      <header className="min-w-0">
        {mode === "build" ? (
          <div className="grid grid-cols-4 gap-2">
            {Arr.map(SHELVES, (shelf) => (
              <ShelfTab key={shelf} shelf={shelf} />
            ))}
          </div>
        ) : (
          <h2 className="flex h-11 items-center px-1 text-sm font-medium">
            {t("mode-brush")}
          </h2>
        )}
      </header>
      <div className="sideways:min-h-0 sideways:flex-1 min-w-0 lg:col-span-2 lg:row-start-2">
        {mode === "build" ? (
          <ThingList />
        ) : (
          <div className="sideways:grid-cols-3 grid grid-cols-3 gap-2 md:grid-cols-9">
            {Arr.map(Brush.literals, (brush) => (
              <BrushTile brush={brush} key={brush} />
            ))}
          </div>
        )}
      </div>
      <ShelfActions />
    </section>
  );
}

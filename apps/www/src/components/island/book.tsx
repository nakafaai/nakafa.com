"use client";

import {
  BucketIcon,
  Cancel01Icon,
  House03Icon,
  LanternIcon,
  PineTreeIcon,
  SquareLock02Icon,
} from "@hugeicons/core-free-icons";
import {
  BLOCK_KEYS,
  type BlockKey,
  isOpen,
  opensAt,
} from "@repo/backend/confect/island/blocks";
import { PLANT_KEYS } from "@repo/backend/confect/island/flora";
import { AWARD_RULES } from "@repo/backend/confect/island/schema";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { BlockIcon, SpeciesIcon } from "@/components/island/icon";
import { panelVariants } from "@/components/island/panel";
import { useGame } from "@/components/island/store";
import { SPECIES } from "@/lib/island/fauna/species";
import { ITEM_KEYS, itemOpensAt } from "@/lib/island/items";
import { isPlant } from "@/lib/island/look";

/** The icon each ready-made item shows in the book. */
const ITEM_ICONS = {
  house: House03Icon,
  lamp: LanternIcon,
  tree: PineTreeIcon,
  well: BucketIcon,
} as const;

/** One ready-made item of the book: open ones go into the hand, locked ones show the level that opens them. */
function ItemEntry({ item }: { item: (typeof ITEM_KEYS)[number] }) {
  const t = useTranslations("Island");
  const level = useGame((state) => state.level);
  const hold = useGame((state) => state.hold);
  const open = itemOpensAt(item) <= level;
  return (
    <li>
      <button
        aria-label={
          open ? t(`item-${item}`) : t("locked", { level: itemOpensAt(item) })
        }
        className="border-island-wood bg-island-straw enabled:hover:bg-island-straw-hover flex w-full flex-col items-center gap-1 border-2 p-1.5 disabled:opacity-55"
        disabled={!open}
        onClick={() => hold(item)}
        title={t(`item-${item}`)}
        type="button"
      >
        <span className="text-island-wood-dark relative grid size-10 place-items-center">
          <HugeIcons icon={ITEM_ICONS[item]} />
          {open ? null : (
            <HugeIcons
              className="text-island-bark absolute -right-1 -bottom-1"
              icon={SquareLock02Icon}
            />
          )}
        </span>
        <span className="text-sm leading-tight text-balance hyphens-auto">
          {open ? t(`item-${item}`) : t("level", { level: itemOpensAt(item) })}
        </span>
      </button>
    </li>
  );
}

/** One block or plant of the book: open ones go into the held slot of the hotbar, locked ones show the level that opens them. */
function BlockEntry({ block }: { block: BlockKey }) {
  const t = useTranslations("Island");
  const level = useGame((state) => state.level);
  const slot = useGame((state) => state.slot);
  const assign = useGame((state) => state.assign);
  const setBook = useGame((state) => state.setBook);
  const open = isOpen(block, level);
  return (
    <li>
      <button
        aria-label={
          open ? t(`block-${block}`) : t("locked", { level: opensAt(block) })
        }
        className="border-island-wood bg-island-straw enabled:hover:bg-island-straw-hover flex w-full flex-col items-center gap-1 border-2 p-1.5 disabled:opacity-55"
        disabled={!open}
        onClick={() => {
          assign(slot, block);
          setBook(false);
        }}
        title={t(`block-${block}`)}
        type="button"
      >
        <span className="relative size-10">
          <BlockIcon block={block} />
          {open ? null : (
            <HugeIcons
              className="text-island-bark absolute -right-1 -bottom-1"
              icon={SquareLock02Icon}
            />
          )}
        </span>
        <span className="text-sm leading-tight text-balance hyphens-auto">
          {open ? t(`block-${block}`) : t("level", { level: opensAt(block) })}
        </span>
      </button>
    </li>
  );
}

/**
 * The block book (ADR 0047, D7, D10 and D11): the ready-made items a press
 * places whole, every plant and every block (open ones go into the hotbar,
 * locked ones show the level that opens them), a field guide of every animal,
 * and how Stars are earned.
 */
export function IslandBook() {
  const t = useTranslations("Island");
  const setBook = useGame((state) => state.setBook);
  return (
    <div className="bg-island-shade/40 pointer-events-auto absolute inset-0 grid place-items-center p-4">
      <section
        aria-label={t("book")}
        className={panelVariants({
          className: "flex max-h-full w-full max-w-lg flex-col gap-3 p-4",
        })}
      >
        <header className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="font-semibold">{t("book")}</h2>
            <p className="text-island-bark-soft text-sm">
              {t("earn", {
                lesson: AWARD_RULES.lesson.stars,
                section: AWARD_RULES.section.stars,
                set: AWARD_RULES.set.stars,
              })}
            </p>
          </div>
          <button
            aria-label={t("close")}
            className="border-island-wood bg-island-straw hover:bg-island-straw-hover grid size-9 shrink-0 place-items-center border-2"
            onClick={() => setBook(false)}
            title={t("close")}
            type="button"
          >
            <HugeIcons icon={Cancel01Icon} />
          </button>
        </header>
        <div className="flex flex-col gap-3 overflow-y-auto">
          <h3 className="text-sm font-semibold">{t("items")}</h3>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Arr.map(ITEM_KEYS, (item) => (
              <ItemEntry item={item} key={item} />
            ))}
          </ul>
          <h3 className="text-sm font-semibold">{t("plants")}</h3>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Arr.map(PLANT_KEYS, (block) => (
              <BlockEntry block={block} key={block} />
            ))}
          </ul>
          <h3 className="text-sm font-semibold">{t("blocks")}</h3>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Arr.map(
              Arr.filter(BLOCK_KEYS, (block) => !isPlant(block)),
              (block) => (
                <BlockEntry block={block} key={block} />
              )
            )}
          </ul>
          <h3 className="text-sm font-semibold">{t("animals")}</h3>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Arr.map(SPECIES, (species, index) => (
              <li
                className="border-island-rule bg-island-page flex flex-col items-center gap-1 border-2 p-1.5 text-center"
                key={species.key}
              >
                <span className="size-10">
                  <SpeciesIcon index={index} />
                </span>
                <span className="text-sm leading-tight text-balance hyphens-auto">
                  {t(`animal-${species.key}`)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

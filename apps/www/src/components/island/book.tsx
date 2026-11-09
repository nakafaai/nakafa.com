"use client";

import {
  BookOpen01Icon,
  BucketIcon,
  Cancel01Icon,
  CubeIcon,
  FishingHookIcon,
  House03Icon,
  LanternIcon,
  Medal01Icon,
  PawPrintIcon,
  PineTreeIcon,
  Plant02Icon,
  Quiz01Icon,
  Search01Icon,
  SquareLock02Icon,
  StarIcon,
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
import { cva } from "class-variance-authority";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { BlockIcon, SpeciesIcon } from "@/components/island/icon";
import { panelVariants } from "@/components/island/panel";
import { type Shelf, useGame } from "@/components/island/store";
import { SPECIES } from "@/lib/island/fauna/species";
import { ITEM_KEYS, itemOpensAt } from "@/lib/island/items";
import { isPlant } from "@/lib/island/look";

/** The icon of each ready-made item. */
const ITEM_ICONS = {
  house: House03Icon,
  lamp: LanternIcon,
  tree: PineTreeIcon,
  well: BucketIcon,
} as const;

/** The icon of each shelf's tab. */
const SHELF_ICONS = {
  animals: PawPrintIcon,
  blocks: CubeIcon,
  items: House03Icon,
  plants: Plant02Icon,
} as const;

/** One entry of a shelf: open and pressable, locked and dimmed, or a picture in the field guide. */
const entryVariants = cva(
  "flex w-full flex-col items-center gap-1 border-2 p-1.5 text-center outline-none focus-visible:border-[#fff3c4]",
  {
    defaultVariants: { state: "open" },
    variants: {
      state: {
        guide: "border-[#c9a46c] bg-[#f3dfb6]",
        locked: "cursor-not-allowed border-[#a9865a] bg-[#e9c992] opacity-55",
        open: "cursor-pointer border-[#7a4a26] bg-[#e9c992] hover:bg-[#f0d6a6] active:translate-y-px",
      },
    },
  }
);

/** One tab of the book's shelves. */
const tabVariants = cva(
  "flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-0.5 border-2 px-1 py-1.5 text-sm outline-none focus-visible:border-[#fff3c4]",
  {
    defaultVariants: { open: false },
    variants: {
      open: {
        false: "border-[#a9865a] bg-[#e9c992] hover:bg-[#f0d6a6]",
        true: "border-[#4a2c17] bg-[#ffe9a8] font-semibold",
      },
    },
  }
);

/** The lock over an entry its island's level has not opened yet. */
function Lock() {
  return (
    <HugeIcons
      className="absolute -right-1 -bottom-1 size-4 text-[#3b2414]"
      icon={SquareLock02Icon}
    />
  );
}

/** One ready-made item: open ones go into the hand, locked ones show the level that opens them. */
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
        className={entryVariants({ state: open ? "open" : "locked" })}
        disabled={!open}
        onClick={() => hold(item)}
        title={t(`item-${item}`)}
        type="button"
      >
        <span className="relative grid size-10 place-items-center text-[#4a2c17]">
          <HugeIcons className="size-8" icon={ITEM_ICONS[item]} />
          {open ? null : <Lock />}
        </span>
        <span className="text-sm leading-tight text-balance hyphens-auto">
          {open ? t(`item-${item}`) : t("level", { level: itemOpensAt(item) })}
        </span>
      </button>
    </li>
  );
}

/** One block or plant: open ones go into the held slot of the hotbar, locked ones show the level that opens them. */
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
        className={entryVariants({ state: open ? "open" : "locked" })}
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
          {open ? null : <Lock />}
        </span>
        <span className="text-sm leading-tight text-balance hyphens-auto">
          {open ? t(`block-${block}`) : t("level", { level: opensAt(block) })}
        </span>
      </button>
    </li>
  );
}

/** One animal of the field guide: its picture and its name, with a hook on the ones the learner caught today. */
function SpeciesEntry({ index }: { index: number }) {
  const t = useTranslations("Island");
  const caught = useGame((state) => Arr.contains(state.catches, index));
  return (
    <li className={entryVariants({ state: "guide" })}>
      <span className="relative size-10">
        <SpeciesIcon index={index} />
        {caught ? (
          <HugeIcons
            aria-label={t("rod")}
            className="absolute -right-1 -bottom-1 size-4 text-[#2c6ec2]"
            icon={FishingHookIcon}
          />
        ) : null}
      </span>
      <span className="text-sm leading-tight text-balance hyphens-auto">
        {t(`animal-${SPECIES[index].key}`)}
      </span>
    </li>
  );
}

/** Whether a name holds what the search looks for. */
function matches(name: string, query: string) {
  return name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}

/** The open shelf's entries, filtered by the search, in one scrolling grid. */
function ShelfGrid() {
  const t = useTranslations("Island");
  const shelf = useGame((state) => state.shelf);
  const query = useGame((state) => state.query);
  const grid = "grid grid-cols-3 gap-2 sm:grid-cols-4";
  if (shelf === "items") {
    return (
      <ul className={grid}>
        {Arr.map(
          Arr.filter(ITEM_KEYS, (item) => matches(t(`item-${item}`), query)),
          (item) => (
            <ItemEntry item={item} key={item} />
          )
        )}
      </ul>
    );
  }
  if (shelf === "animals") {
    return (
      <ul className={grid}>
        {Arr.map(
          Arr.filter(
            Arr.makeBy(SPECIES.length, (index) => index),
            (index) => matches(t(`animal-${SPECIES[index].key}`), query)
          ),
          (index) => (
            <SpeciesEntry index={index} key={SPECIES[index].key} />
          )
        )}
      </ul>
    );
  }
  const blocks =
    shelf === "plants"
      ? PLANT_KEYS
      : Arr.filter(BLOCK_KEYS, (block) => !isPlant(block));
  return (
    <ul className={grid}>
      {Arr.map(
        Arr.filter(blocks, (block) => matches(t(`block-${block}`), query)),
        (block) => (
          <BlockEntry block={block} key={block} />
        )
      )}
    </ul>
  );
}

/** The book's shelves as tabs, each with its icon and its name. */
function ShelfTabs() {
  const t = useTranslations("Island");
  const shelf = useGame((state) => state.shelf);
  const setShelf = useGame((state) => state.setShelf);
  return (
    <div aria-label={t("book")} className="flex gap-1" role="tablist">
      {Arr.map(
        ["items", "plants", "blocks", "animals"] as const,
        (name: Shelf) => (
          <button
            aria-controls="island-shelf"
            aria-selected={shelf === name}
            className={tabVariants({ open: shelf === name })}
            key={name}
            onClick={() => setShelf(name)}
            role="tab"
            type="button"
          >
            <HugeIcons className="size-5" icon={SHELF_ICONS[name]} />
            <span className="max-w-full truncate">{t(name)}</span>
          </button>
        )
      )}
    </div>
  );
}

/** The Stars each kind of learning earns, shown as icons and numbers; their words stay for screen readers. */
function Earnings() {
  const t = useTranslations("Island");
  const chips = [
    { icon: BookOpen01Icon, stars: AWARD_RULES.lesson.stars },
    { icon: Quiz01Icon, stars: AWARD_RULES.section.stars },
    { icon: Medal01Icon, stars: AWARD_RULES.set.stars },
  ] as const;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <p className="sr-only">
        {t("earn", {
          lesson: AWARD_RULES.lesson.stars,
          section: AWARD_RULES.section.stars,
          set: AWARD_RULES.set.stars,
        })}
      </p>
      {Arr.map(chips, (chip) => (
        <span
          aria-hidden="true"
          className="flex items-center gap-1 border-2 border-[#c9a46c] bg-[#f3dfb6] px-1.5 py-0.5 text-sm font-semibold tabular-nums"
          key={chip.stars}
        >
          <HugeIcons className="size-4 text-[#7a4a26]" icon={chip.icon} />
          <HugeIcons className="size-4 text-[#c6911f]" icon={StarIcon} />+
          {chip.stars}
        </span>
      ))}
    </div>
  );
}

/** The search over the open shelf. */
function Search() {
  const t = useTranslations("Island");
  const query = useGame((state) => state.query);
  const setQuery = useGame((state) => state.setQuery);
  return (
    <label className="flex items-center gap-2 border-2 border-[#a9865a] bg-[#fbf1da] px-2 focus-within:border-[#4a2c17]">
      <HugeIcons
        className="size-4 shrink-0 text-[#7a4a26]"
        icon={Search01Icon}
      />
      <span className="sr-only">{t("search")}</span>
      <input
        className="h-9 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[#9a7a52]"
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("search")}
        type="search"
        value={query}
      />
    </label>
  );
}

/**
 * The block book (ADR 0047, D7, D10 and D11) as a sheet: from the bottom on a
 * phone and from the right on a wide screen, over the world. Tabs open its
 * shelves (ready-made items, plants, blocks, and the field guide of animals), a
 * search filters the open shelf, and only the shelf scrolls, so the header and
 * the tabs stay in reach. A press outside it or Escape (read by the stage) closes it.
 */
export function IslandBook() {
  const t = useTranslations("Island");
  const setBook = useGame((state) => state.setBook);
  return (
    <div className="pointer-events-auto absolute inset-0 flex items-end justify-center sm:items-stretch sm:justify-end">
      <button
        aria-label={t("close")}
        className="absolute inset-0 cursor-default bg-[#1b100a]/40"
        onClick={() => setBook(false)}
        tabIndex={-1}
        type="button"
      />
      <section
        aria-label={t("book")}
        aria-modal="true"
        className={panelVariants({
          className:
            "relative flex max-h-[88dvh] w-full flex-col gap-3 overflow-hidden p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-h-full sm:w-[26rem]",
        })}
        role="dialog"
      >
        <header className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <h2 className="font-semibold">{t("book")}</h2>
            <Earnings />
          </div>
          <button
            aria-label={t("close")}
            className="grid size-10 shrink-0 cursor-pointer place-items-center border-2 border-[#7a4a26] bg-[#e9c992] outline-none hover:bg-[#f0d6a6] focus-visible:border-[#fff3c4]"
            onClick={() => setBook(false)}
            title={t("close")}
            type="button"
          >
            <HugeIcons className="size-5" icon={Cancel01Icon} />
          </button>
        </header>
        <ShelfTabs />
        <Search />
        <div
          className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain pr-1"
          id="island-shelf"
          role="tabpanel"
        >
          <ShelfGrid />
        </div>
      </section>
    </div>
  );
}

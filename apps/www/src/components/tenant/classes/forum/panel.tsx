import {
  Apple01Icon,
  BulbIcon,
  Car01Icon,
  FavouriteIcon,
  FootballIcon,
  HandPointingRightIcon,
  Leaf01Icon,
  SmileIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { SearchField } from "@repo/design-system/components/ui/search";
import { Array as Arr, Number as Num, Option } from "effect";
import { useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import {
  type EmojiCategory,
  type EmojiEntry,
  type EmojiSection,
  emojiOf,
  emojiSections,
  gridRows,
  matchEmoji,
  sectionStarts,
  stepEmoji,
} from "@/components/tenant/classes/forum/emoji";
import { IconTip } from "@/components/tenant/classes/forum/tip";

/** How many emoji a row of the chooser holds. */
const COLUMNS = 8;

/** The icon of each category on its tab, the one its own emoji shows at a glance. */
const CATEGORY_ICONS = {
  activities: FootballIcon,
  food: Apple01Icon,
  nature: Leaf01Icon,
  objects: BulbIcon,
  people: HandPointingRightIcon,
  smileys: SmileIcon,
  symbols: FavouriteIcon,
  travel: Car01Icon,
};

/**
 * The emoji chooser of a chat, as a command palette works: a search field that keeps the focus, the categories as
 * tabs, and the emoji in a grid under them. Typing finds emoji by their words in the reader's language and in
 * English, the arrow keys move the active emoji across the grid, Enter picks it, and Escape clears the search, then
 * closes the popover. The footer names the active emoji. A pointer picks one with a press.
 */
export function EmojiPanel({
  glyphs,
  onPick,
}: {
  glyphs: readonly (typeof EmojiEntry.Type)[];
  onPick: (emoji: string) => void;
}) {
  const t = useTranslations("Classroom");
  const common = useTranslations("Common");
  const locale = useLocale();
  const id = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const emojis = Arr.map(glyphs, (glyph) => emojiOf(glyph, locale));
  const grouped = emojiSections(emojis);
  const categories: readonly (typeof EmojiSection.Type)[] = Arr.map(
    grouped,
    (section) => ({
      emojis: section.emojis,
      key: section.category,
      label: t(`emoji-${section.category}`),
    })
  );
  const found = matchEmoji(emojis, query);
  // A search shows its matches as one section; an empty search shows every category in its order.
  const sections: readonly (typeof EmojiSection.Type)[] =
    query === ""
      ? categories
      : Arr.match(found, {
          onEmpty: () => [],
          onNonEmpty: (held) => [
            { emojis: held, key: "results", label: t("emoji-results") },
          ],
        });
  const shown = Arr.flatMap(sections, (section) => section.emojis);
  const rows = gridRows(
    Arr.map(sections, (section) => section.emojis.length),
    COLUMNS
  );
  const index = Num.clamp(active, { maximum: shown.length - 1, minimum: 0 });
  const current = Arr.get(shown, index);
  const optionId = (at: number) => `${id}-${at}`;
  const starts = sectionStarts(
    Arr.map(sections, (section) => section.emojis.length)
  );

  /** Makes `at` the active emoji and brings it into view. */
  const activate = (at: number) => {
    setActive(at);
    list.current
      ?.querySelector(`[data-place="${at}"]`)
      ?.scrollIntoView({ block: "nearest" });
  };

  return (
    <div className="flex w-full flex-col" data-slot="emoji-panel">
      <div className="p-2">
        <SearchField
          aria-activedescendant={
            Option.isSome(current) ? optionId(index) : undefined
          }
          aria-controls={`${id}-list`}
          onKeyDownCapture={(event) => {
            if (event.key === "Enter" && Option.isSome(current)) {
              event.preventDefault();
              onPick(current.value.emoji);
              return;
            }
            Option.map(stepEmoji(rows, index, event.key), (next) => {
              event.preventDefault();
              activate(next);
            });
          }}
          onValueChange={(next) => {
            setQuery(next);
            setActive(0);
          }}
          placeholder={t("emoji-search")}
          value={query}
        />
      </div>
      <div
        aria-label={t("emoji-categories")}
        className="grid grid-cols-8 justify-items-center border-b px-1 pb-2"
        role="toolbar"
      >
        {Arr.map(grouped, (section, at) => (
          <CategoryTab
            category={section.category}
            current={
              query === "" &&
              Option.exists(
                current,
                (emoji) => emoji.category === section.category
              )
            }
            key={section.category}
            onPress={() => {
              setQuery("");
              activate(
                Arr.getUnsafe(
                  sectionStarts(
                    Arr.map(categories, (held) => held.emojis.length)
                  ),
                  at
                )
              );
              list.current
                ?.querySelector(`[data-section="${section.category}"]`)
                ?.scrollIntoView({ block: "start" });
            }}
          />
        ))}
      </div>
      <div
        aria-label={t("emoji-list")}
        className="h-56 overflow-y-auto overscroll-contain px-2 pb-2"
        id={`${id}-list`}
        ref={list}
        role="listbox"
      >
        {Arr.isReadonlyArrayEmpty(sections) ? (
          <p className="text-muted-foreground flex h-full items-center justify-center text-center text-sm">
            {common("no-emoji-found")}
          </p>
        ) : null}
        {Arr.map(sections, (section, at) => (
          <fieldset
            aria-labelledby={`${id}-${section.key}`}
            className="m-0 min-h-0 min-w-0 border-0 p-0"
            key={section.key}
          >
            <p
              className="bg-popover text-muted-foreground sticky top-0 z-10 px-1 pt-2 pb-1 text-xs font-medium"
              data-section={section.key}
              id={`${id}-${section.key}`}
            >
              {section.label}
            </p>
            <div className="grid grid-cols-8 gap-0.5">
              {Arr.map(section.emojis, (emoji, offset) => {
                const place = Arr.getUnsafe(starts, at) + offset;
                return (
                  <div
                    aria-label={emoji.name}
                    aria-selected={place === index}
                    className="data-[active=true]:bg-accent flex aspect-square cursor-pointer items-center justify-center rounded-md text-xl leading-none"
                    data-active={place === index}
                    data-place={place}
                    id={optionId(place)}
                    key={emoji.emoji}
                    onClick={() => onPick(emoji.emoji)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onPick(emoji.emoji);
                      }
                    }}
                    // The field keeps the focus and the keys of the grid, so a press never takes it.
                    onMouseDown={(event) => event.preventDefault()}
                    onPointerMove={() => setActive(place)}
                    role="option"
                    tabIndex={-1}
                  >
                    {emoji.emoji}
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="flex min-h-12 items-center gap-2 border-t p-2">
        {Option.match(current, {
          onNone: () => (
            <span className="text-muted-foreground px-1 text-sm">
              {common("emoji-picker-placeholder")}
            </span>
          ),
          onSome: (emoji) => (
            <>
              <span aria-hidden="true" className="text-2xl leading-none">
                {emoji.emoji}
              </span>
              <span className="min-w-0 text-sm wrap-anywhere">
                {emoji.name}
              </span>
            </>
          ),
        })}
      </div>
    </div>
  );
}

/** One category's tab, which jumps the grid to the category and names it in its tooltip. */
function CategoryTab({
  category,
  current,
  onPress,
}: {
  category: typeof EmojiCategory.Type;
  current: boolean;
  onPress: () => void;
}) {
  const t = useTranslations("Classroom");
  const label = t(`emoji-${category}`);

  return (
    <IconTip label={label}>
      <Button
        aria-label={label}
        aria-pressed={current}
        className="aria-pressed:bg-accent aria-pressed:text-accent-foreground"
        onClick={onPress}
        onMouseDown={(event) => event.preventDefault()}
        size="icon"
        type="button"
        variant="ghost"
      >
        <HugeIcons icon={CATEGORY_ICONS[category]} />
      </Button>
    </IconTip>
  );
}

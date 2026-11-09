import {
  BookOpen01Icon,
  Calendar03Icon,
  DashboardSquare01Icon,
  FilterHorizontalIcon,
  Folder01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr, Option, Schema } from "effect";
import { useTranslations } from "use-intl";
import {
  DirectoryCategory,
  type DirectoryEntry,
  directoryCategories,
} from "@/components/connectors/directory";
import { chosenOne } from "@/components/shared/table/filter";
import { useTableFilters } from "@/components/shared/table/toolbar";

/** The name of the directory's category in the page's filters. */
export const CATEGORY_FILTER = "category";

/** The value of the filter that keeps every category. */
const ALL = "all";

/** The icon of each category, and of all of them, which a new category names here. */
const CATEGORY_ICONS = {
  [ALL]: DashboardSquare01Icon,
  files: Folder01Icon,
  learning: BookOpen01Icon,
  schedule: Calendar03Icon,
};

/** The header's filter of `services` by category, which shows itself pressed while one is chosen. */
export function ServiceFilter({
  services,
}: {
  services: readonly (typeof DirectoryEntry.Type)["service"][];
}) {
  const t = useTranslations("Connectors");
  const common = useTranslations("Common");
  const chosen = useTableFilters((state) => state.chosen);
  const choose = useTableFilters((state) => state.choose);
  const category = chosenOne(
    chosen,
    CATEGORY_FILTER,
    Schema.is(DirectoryCategory)
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-pressed={Option.isSome(category)}
            size="icon"
            tooltip={t("filter")}
            type="button"
            variant="outline"
          >
            <HugeIcons icon={FilterHorizontalIcon} />
          </Button>
        }
      />
      <DropdownMenuContent
        align="end"
        className="min-w-48"
        label={common("menu-filter")}
      >
        <DropdownMenuRadioGroup
          onValueChange={(next) =>
            choose(
              CATEGORY_FILTER,
              Schema.is(DirectoryCategory)(next) ? [next] : []
            )
          }
          value={Option.getOrElse(category, () => ALL)}
        >
          <DropdownMenuRadioItem icon={CATEGORY_ICONS[ALL]} value={ALL}>
            {common("all")}
          </DropdownMenuRadioItem>
          {Arr.map(directoryCategories(services), (shown) => (
            <DropdownMenuRadioItem
              icon={CATEGORY_ICONS[shown]}
              key={shown}
              value={shown}
            >
              {t(`category.${shown}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

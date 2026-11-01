import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { cn } from "cn";
import { Array as Arr, Schema } from "effect";
import { useTranslations } from "use-intl";
import { ServiceCard } from "@/components/connectors/card";
import {
  DirectoryCategory,
  type DirectoryEntry,
  holderOf,
  isShown,
} from "@/components/connectors/directory";
import { CATEGORY_FILTER, ServiceFilter } from "@/components/connectors/filter";
import { pageGutterVariants } from "@/components/shared/content/width";
import { chosenOne } from "@/components/shared/table/filter";
import { TableEmpty } from "@/components/shared/table/frame";
import {
  TableSearch,
  useTableFilters,
} from "@/components/shared/table/toolbar";

/** The search and the filter of a connector page's header. */
export function LibraryControls({
  services,
}: {
  services: readonly (typeof DirectoryEntry.Type)["service"][];
}) {
  const t = useTranslations("Connectors");

  return (
    <ButtonGroup>
      <TableSearch placeholder={t("search")} />
      <ServiceFilter services={services} />
    </ButtonGroup>
  );
}

/**
 * The services the search and the filter keep, in two columns of one card size while the pane has
 * the room, so a new connector only adds a card, and a pane that narrows only folds them into one.
 */
export function ServiceList({
  entries,
}: {
  entries: readonly (typeof DirectoryEntry.Type)[];
}) {
  const t = useTranslations("Connectors");
  const search = useTableFilters((state) => state.search);
  const chosen = useTableFilters((state) => state.chosen);
  const category = chosenOne(
    chosen,
    CATEGORY_FILTER,
    Schema.is(DirectoryCategory)
  );
  const shown = Arr.filter(entries, ({ service }) =>
    isShown(service, category, search, [
      t(service.key),
      t(`${service.key}-line`),
      t(`holder-${holderOf(service)}`),
      service.provider,
    ])
  );

  if (Arr.isReadonlyArrayEmpty(shown)) {
    return (
      <TableEmpty
        act="searching"
        description={t("search-none-description")}
        title={t("search-none")}
      />
    );
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className={cn(pageGutterVariants(), "@container py-4")}>
        <div className="grid auto-rows-fr gap-4 @xl:grid-cols-2">
          {Arr.map(shown, (entry) => (
            <ServiceCard entry={entry} key={entry.service.key} />
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}

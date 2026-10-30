import { QueryResult } from "@confect/react";
import {
  Certificate01Icon,
  Home01Icon,
  TaskEdit01Icon,
} from "@hugeicons/core-free-icons";
import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandSeparator,
} from "@repo/design-system/components/ui/command";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import type { Mascot } from "@repo/mascot/code";
import { useNavigate } from "@tanstack/react-router";
import { Array as Arr } from "effect";
import { type ComponentProps, Fragment, useTransition } from "react";
import { useTranslations } from "use-intl";
import { CommandKeys } from "@/components/search/keys";
import { withMarks } from "@/components/tenant/classes/marks";
import { useMyClasses } from "@/components/tenant/classes/mine";
import { useTenant } from "@/components/tenant/context";
import { settingsSectionIcons } from "@/components/tenant/settings/icons";
import type { LinkTarget } from "@/lib/routing/link";
import { LOCALE_ROUTE } from "@/lib/routing/tree";
import { schoolSettingsGroups } from "@/lib/settings/school";

/** One place of the school the palette opens: a page, a class or a section of the settings. */
interface PaletteItem {
  readonly icon:
    | { readonly hugeicon: ComponentProps<typeof HugeIcons>["icon"] }
    | { readonly mascot: typeof Mascot.Type };
  readonly key: string;
  readonly label: string;
  /** Where a section of the settings lives, shown after its name: its group. */
  readonly place: string | undefined;
  readonly target: LinkTarget;
}

/** One group of the palette, named as the sidebar names it. */
interface PaletteGroup {
  readonly items: readonly PaletteItem[];
  readonly value: string;
}

/**
 * The palette of the school sidebar's search: every page, class and setting that the
 * viewer may open, grouped as the sidebar groups them, found by name or by the group
 * it lives in. A row opens its page and closes the palette.
 */
export function TenantPalette({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const t = useTranslations("School");

  return (
    <CommandDialog onOpenChange={onOpenChange} open={open}>
      <CommandDialogPopup
        description={t("search-description")}
        initialFocus
        portalProps={{ keepMounted: true }}
        title={t("search")}
      >
        <TenantPaletteCommand onOpened={() => onOpenChange(false)} />
      </CommandDialogPopup>
    </CommandDialog>
  );
}

/** The search field, the groups and the keys of the palette. */
function TenantPaletteCommand({ onOpened }: { onOpened: () => void }) {
  const t = useTranslations("School");
  const tCommon = useTranslations("Common");
  const groups = usePaletteGroups();
  const navigate = useNavigate();
  const [isPending, startTransition] = useTransition();

  function openItem(item: PaletteItem) {
    startTransition(() => {
      onOpened();
      navigate(item.target);
    });
  }

  return (
    <Command
      items={groups}
      itemToStringValue={(item: PaletteItem) =>
        item.place === undefined ? item.label : `${item.label} ${item.place}`
      }
      loopFocus
    >
      <CommandInput
        clearLabel={tCommon("clear-search")}
        placeholder={t("search-placeholder")}
      />
      <CommandPanel>
        <CommandEmpty className="p-6 text-center text-muted-foreground text-sm">
          {t("search-empty")}
        </CommandEmpty>
        <CommandList>
          {(group: PaletteGroup, index: number) => (
            <Fragment key={group.value}>
              <CommandGroup items={group.items}>
                <CommandGroupLabel>{group.value}</CommandGroupLabel>
                <CommandCollection>
                  {(item: PaletteItem) => (
                    <TenantPaletteRow
                      disabled={isPending}
                      item={item}
                      key={item.key}
                      onOpen={() => openItem(item)}
                    />
                  )}
                </CommandCollection>
              </CommandGroup>
              {index === groups.length - 1 ? null : (
                <CommandSeparator className="my-2" />
              )}
            </Fragment>
          )}
        </CommandList>
      </CommandPanel>
      <CommandKeys />
    </Command>
  );
}

/** One row of the palette: its mark, its name, and the group a section of the settings lives in. */
function TenantPaletteRow({
  disabled,
  item,
  onOpen,
}: {
  disabled: boolean;
  item: PaletteItem;
  onOpen: () => void;
}) {
  return (
    <CommandItem
      className="cursor-pointer"
      disabled={disabled}
      onClick={onOpen}
      value={item}
    >
      {"mascot" in item.icon ? (
        <PersonAvatar className="size-4" mascot={item.icon.mascot} />
      ) : (
        <HugeIcons icon={item.icon.hugeicon} />
      )}
      <span className="truncate" dir="auto">
        {item.label}
      </span>
      {item.place === undefined ? null : (
        <span className="ms-auto shrink-0 text-muted-foreground text-xs">
          {item.place}
        </span>
      )}
    </CommandItem>
  );
}

/**
 * The palette's groups for this viewer, in the sidebar's order: the school's pages the
 * viewer may open, the viewer's classes once they are read, and the settings for a
 * viewer who may manage the school.
 */
function usePaletteGroups(): readonly PaletteGroup[] {
  const { canManage, canOpenExams, canOpenReports, slug } = useTenant();
  const classes = useMyClasses();
  const t = useTranslations("School");
  const tExams = useTranslations("Exams");
  const tReports = useTranslations("SchoolReports");
  const tSettings = useTranslations("SchoolSettings");

  const pages: readonly PaletteItem[] = [
    {
      icon: { hugeicon: Home01Icon },
      key: "home",
      label: t("home"),
      place: undefined,
      target: { from: LOCALE_ROUTE, params: { slug }, to: "/school/$slug" },
    },
    ...(canOpenExams
      ? [
          {
            icon: { hugeicon: TaskEdit01Icon },
            key: "exams",
            label: tExams("title"),
            place: undefined,
            target: {
              from: LOCALE_ROUTE,
              params: { slug },
              to: "/school/$slug/exams",
            },
          } satisfies PaletteItem,
        ]
      : []),
    ...(canOpenReports
      ? [
          {
            icon: { hugeicon: Certificate01Icon },
            key: "reports",
            label: tReports("title"),
            place: undefined,
            target: {
              from: LOCALE_ROUTE,
              params: { slug },
              to: "/school/$slug/reports",
            },
          } satisfies PaletteItem,
        ]
      : []),
  ];
  const classItems = Arr.map(
    withMarks(QueryResult.isSuccess(classes) ? classes.value : []),
    (klass): PaletteItem => ({
      icon: { mascot: klass.mascot },
      key: `class:${klass.id}`,
      label: klass.name,
      place: undefined,
      target: {
        from: LOCALE_ROUTE,
        params: { classSlug: klass.slug, slug },
        to: "/school/$slug/classes/$classSlug",
      },
    })
  );
  const settingsItems = canManage
    ? Arr.flatMap(schoolSettingsGroups(slug), (group) =>
        Arr.map(
          group.sections,
          (section): PaletteItem => ({
            icon: { hugeicon: settingsSectionIcons[section.labelKey] },
            key: `settings:${section.labelKey}`,
            label: tSettings(section.labelKey),
            place: tSettings(group.key),
            target: section.target,
          })
        )
      )
    : [];

  return Arr.filter(
    [
      { items: pages, value: t("pages") },
      { items: classItems, value: t("classes") },
      { items: settingsItems, value: tSettings("manage-settings") },
    ],
    (group) => group.items.length > 0
  );
}

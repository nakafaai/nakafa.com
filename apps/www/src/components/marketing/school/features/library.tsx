import {
  Folder01Icon,
  Image01Icon,
  Link04Icon,
  Pdf02Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Nina } from "@repo/design-system/components/ui/nina";
import { Array as Arr, DateTime } from "effect";
import { useFormatter, useTranslations } from "use-intl";
import { DEMO_TEACHER } from "@/components/marketing/school/features/cast";
import { SchoolFeatureText } from "@/components/marketing/school/features/text";
import {
  FeatureProduct,
  FeatureRow,
} from "@/components/marketing/shared/feature";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { namedOptions } from "@/components/shared/table/filter";
import { TablePageBody } from "@/components/shared/table/frame";
import { RowCopy } from "@/components/shared/table/menu";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import { PERSON_ICONS } from "@/components/tenant/settings/choices";

/** The icon of each kind of entry, as the class library draws it. */
const KIND_ICONS = {
  folder: Folder01Icon,
  image: Image01Icon,
  link: Link04Icon,
  pdf: Pdf02Icon,
};

/** The day each entry was added, as an instant the table prints. */
function added(day: string) {
  return DateTime.toEpochMillis(DateTime.makeUnsafe(`${day}T03:00:00Z`));
}

/**
 * The class's drive, as its library lists it, the chapter's folder first: the key of each entry's
 * title, its kind, who added it, and when.
 */
const DEMO_ENTRIES = [
  { added: added("2026-11-02"), by: "teacher", kind: "folder", title: "folder" },
  {
    added: added("2026-11-03"),
    by: "teacher",
    kind: "pdf",
    title: "worksheet",
  },
  { added: added("2026-11-04"), by: "nina", kind: "pdf", title: "summary" },
  { added: added("2026-11-05"), by: "teacher", kind: "link", title: "video" },
  { added: added("2026-11-06"), by: "nina", kind: "image", title: "formulas" },
] as const;

/** One entry of the demo's library. */
type DemoEntry = (typeof DEMO_ENTRIES)[number];

/** The columns of the demo's library table. */
const libraryColumns = tableColumns<DemoEntry>();

/** The title of an entry, after the icon of its kind, as the library's own rows draw it. */
function EntryTitle({ entry }: { entry: DemoEntry }) {
  const t = useTranslations("SchoolSite");

  return (
    <span className="flex items-center gap-2 font-medium">
      <HugeIcons
        aria-label={t(`demo-kind-${entry.kind}`)}
        className="text-muted-foreground size-4 shrink-0"
        icon={KIND_ICONS[entry.kind]}
      />
      {t(`demo-library-${entry.title}`)}
    </span>
  );
}

/**
 * The columns of the class library's table: each entry's title after its kind's icon, its kind, who
 * added it, the day it came, and the row's menu. Every head filters its column, as it does in the
 * School.
 */
function useDemoColumns() {
  const t = useTranslations("SchoolSite");
  const format = useFormatter();
  const author = (entry: DemoEntry) =>
    entry.by === "nina" ? "Nina" : DEMO_TEACHER.name;

  return [
    libraryColumns.text((entry) => t(`demo-library-${entry.title}`), {
      cell: (info) => <EntryTitle entry={info.row.original} />,
      header: t("demo-head-title"),
      id: "title",
    }),
    libraryColumns.values((entry) => entry.kind, {
      cell: (info) => (
        <span className="text-muted-foreground">
          {t(`demo-kind-${info.getValue()}`)}
        </span>
      ),
      header: t("demo-head-type"),
      id: "kind",
      options: Arr.map(["folder", "pdf", "image", "link"] as const, (kind) => ({
        icon: KIND_ICONS[kind],
        label: t(`demo-kind-${kind}`),
        value: kind,
      })),
    }),
    libraryColumns.values(author, {
      cell: (info) => (
        <span className="text-muted-foreground">{info.getValue()}</span>
      ),
      header: t("demo-head-by"),
      id: "author",
      options: namedOptions([DEMO_TEACHER.name, "Nina"], PERSON_ICONS),
    }),
    libraryColumns.days((entry) => entry.added, {
      cell: (info) => (
        <span className="text-muted-foreground tabular-nums">
          {format.dateTime(
            DateTime.toDateUtc(DateTime.makeUnsafe(info.getValue())),
            { dateStyle: "medium", timeZone: "Asia/Jakarta" }
          )}
        </span>
      ),
      header: t("demo-head-added"),
      id: "added",
      timeZone: () => "Asia/Jakarta",
    }),
    libraryColumns.menu((info) => (
      <RowCopy value={t(`demo-library-${info.row.original.title}`)} />
    )),
  ];
}

/**
 * The library part: one class's drive in the School's own library table, the chapter's folder first
 * and its files under it, Nina's summary among them. Its heads filter the rows, and each row's menu
 * copies its title.
 */
export function SchoolLibrary() {
  const columns = useDemoColumns();

  return (
    <FeatureRow id="library" layout="end">
      <SchoolFeatureText feature="library">
        <Nina act="carrying" label="" size={88} whole />
      </SchoolFeatureText>
      <FeatureProduct>
        <TableFiltersProvider>
          <TablePageBody>
            <DataTable
              columns={columns}
              data={DEMO_ENTRIES}
              rowId={(entry) => entry.title}
            />
          </TablePageBody>
        </TableFiltersProvider>
      </FeatureProduct>
    </FeatureRow>
  );
}

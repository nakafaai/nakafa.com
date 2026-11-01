import {
  ArrowDown02Icon,
  ArrowUp02Icon,
  FilterIcon,
  Menu01Icon,
} from "@hugeicons/core-free-icons";
import { setFilterValidator } from "@repo/backend/confect/tryouts/sets/query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { TableRow } from "@repo/design-system/components/ui/table";
import { Array as Arr, Schema } from "effect";
import { useTranslations } from "use-intl";
import { TableHeadButton } from "@/components/shared/table/head";
import {
  ColumnHead,
  ColumnHeads,
  HeadPanel,
  HeadRange,
  HeadReset,
  HeadSort,
  HeadText,
  useIsFiltered,
} from "@/components/shared/table/panel";
import { useTryoutSetTable } from "@/components/tryout/catalog/table/selection";
import type { TryoutSetStatusFilter } from "@/components/tryout/catalog/table/types";
import {
  TryoutStatusIcon,
  TryoutStatusLabel,
} from "@/components/tryout/status";

const headings = {
  title: { kind: "text", label: "set-column-name", menu: "start" },
  questionCount: {
    kind: "number",
    label: "set-column-questions",
    menu: "center",
  },
  durationSeconds: {
    kind: "number",
    label: "set-column-duration",
    menu: "center",
  },
  publishedScore: {
    kind: "number",
    label: "set-column-score",
    menu: "end",
  },
} as const;

/** The icon of a head: the way it sorts the rows, or the filter while it sorts none. */
const sortIcons = {
  asc: ArrowUp02Icon,
  desc: ArrowDown02Icon,
  none: FilterIcon,
};

/** Fixed columns keep the same geometry while the server changes row order. */
export function TryoutTableHeader() {
  return (
    <ColumnHeads>
      <TableRow>
        <TryoutColumnHeading field="title" />
        <TryoutStatusHeading />
        <TryoutColumnHeading field="questionCount" />
        <TryoutColumnHeading field="durationSeconds" />
        <TryoutColumnHeading field="publishedScore" />
      </TableRow>
    </ColumnHeads>
  );
}

/**
 * The head of a column that sorts the track: the URL holds the sort, so a change keeps keyboard focus, and the page's
 * filters hold what the column keeps of the rows the table has read.
 */
function TryoutColumnHeading({ field }: { field: keyof typeof headings }) {
  const { onSort, sort } = useTryoutSetTable();
  const t = useTranslations("Tryouts");
  const filtered = useIsFiltered(field);
  const copy = headings[field];
  const label = t(copy.label);
  const sorted = sort.field === field ? sort.direction : "none";
  const place = field === "title" ? "start" : "center";

  return (
    <ColumnHead menu={copy.menu} place={place} sorted={sorted}>
      <HeadPanel
        trigger={
          <TableHeadButton
            active={sorted !== "none" || filtered}
            align={place}
            aria-label={t("set-filter-label", { column: label })}
            icon={sortIcons[sorted]}
          >
            {label}
          </TableHeadButton>
        }
      >
        <HeadSort
          kind={copy.kind}
          onSort={(descending) =>
            onSort({ direction: descending ? "desc" : "asc", field })
          }
          sorted={sorted}
        />
        {field === "title" ? (
          <HeadText column={field} label={label} />
        ) : (
          <HeadRange column={field} label={label} />
        )}
        <HeadReset column={field} />
      </HeadPanel>
    </ColumnHead>
  );
}

/** Keeps status filtering in the existing column header. */
function TryoutStatusHeading() {
  const { filter, onFilter } = useTryoutSetTable();
  const t = useTranslations("Tryouts");
  return (
    <ColumnHead place="center">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <TableHeadButton
              active={filter !== "all"}
              aria-label={t("set-filter-label", {
                column: t("set-column-status"),
              })}
              icon={FilterIcon}
            >
              {t("set-column-status")}
            </TableHeadButton>
          }
        />
        <DropdownMenuContent
          align="center"
          className="w-max max-w-[calc(100vw-1rem)]"
        >
          <DropdownMenuGroup>
            <DropdownMenuRadioGroup
              onValueChange={(value) => {
                if (Schema.is(setFilterValidator)(value)) {
                  onFilter(value);
                }
              }}
              value={filter}
            >
              {Arr.map(setFilterValidator.literals, (value) => (
                <DropdownMenuRadioItem
                  className="whitespace-normal"
                  key={value}
                  value={value}
                >
                  <TryoutFilterOption filter={value} />
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </ColumnHead>
  );
}

function TryoutFilterOption({ filter }: { filter: TryoutSetStatusFilter }) {
  const t = useTranslations("Tryouts");
  if (filter === "all") {
    return (
      <>
        <HugeIcons icon={Menu01Icon} />
        {t("set-filter-all")}
      </>
    );
  }
  const status = filter === "not-started" ? null : filter;
  return (
    <>
      <TryoutStatusIcon status={status} />
      <TryoutStatusLabel status={status} />
    </>
  );
}

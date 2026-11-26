import {
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Menu01Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { setFilterValidator } from "@repo/backend/confect/tryouts/sets/query";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "cn";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "use-intl";
import { tableColumns } from "@/components/shared/table/columns";
import { RowItems, RowOpen } from "@/components/shared/table/menu";
import { catalogSearchOf } from "@/components/tryout/catalog/table/query";
import { useTryoutSetTable } from "@/components/tryout/catalog/table/selection";
import type {
  TryoutSetRow,
  TryoutSetStatusFilter,
} from "@/components/tryout/catalog/table/types";
import { TryoutLevel, useLevelChoices } from "@/components/tryout/level";
import { statusLook } from "@/components/tryout/progress";
import { getTryoutPublicPathTarget } from "@/components/tryout/route/path";
import { TryoutStatus } from "@/components/tryout/status";
import { Link } from "@/lib/routing/link";

/** The seconds of one minute, the unit the duration column prints and filters by. */
const SECONDS_IN_MINUTE = 60;

/** The columns of a track's sets. */
const setColumns = tableColumns<TryoutSetRow>();

/**
 * The values of the status column, which chooses the sets the server reads: every set, or the sets in one state, each
 * with the look its badge has.
 */
function useStatusChoices() {
  const t = useTranslations("Tryouts");
  const tCommon = useTranslations("Common");

  return Arr.map(
    setFilterValidator.literals,
    (value: TryoutSetStatusFilter) => {
      if (value === "all") {
        return { icon: Menu01Icon, label: tCommon("all"), value };
      }
      const look = statusLook(value === "not-started" ? null : value);
      return { icon: look.icon, label: t(look.label), value };
    }
  );
}

/**
 * The columns of a track's sets: the name, which opens the set, its measured level and the learner's status, which the
 * server filters by, the questions, the minutes and the score. The server sorts the track by the name, the level, from
 * easy up to cooked, and the figures; the heads of text and figures keep the sets the table has read. A learner's
 * progress marks carry `data-progress`, so the rows every visitor reads can hide them under a signed-in hint. Every
 * column stands at every width: a card narrower than the columns scrolls them sideways inside itself, under the row's
 * menu, and the page never scrolls sideways.
 */
export function useTryoutSetColumns() {
  const t = useTranslations("Tryouts");
  const tCommon = useTranslations("Common");
  const statusChoices = useStatusChoices();
  const levelChoices = useLevelChoices();

  return [
    setColumns.text((row) => row.title, {
      cell: (info) => <TryoutSetName row={info.row.original} />,
      header: tCommon("name"),
      id: "title",
      // A set's name is short, such as Set 1, so it holds no more than a short name's room.
      width: "short",
    }),
    setColumns.choice((row) => row.level, {
      cell: (info) => <TryoutLevel level={info.row.original.level} />,
      header: t("set-column-level"),
      id: "level",
      options: levelChoices,
      sort: { asc: t("level-sort-easiest"), desc: t("level-sort-hardest") },
    }),
    setColumns.choice((row) => row.attemptStatus ?? "not-started", {
      cell: (info) => (
        <span className="contents" data-progress>
          <TryoutStatus status={info.row.original.attemptStatus} />
        </span>
      ),
      header: tCommon("state"),
      id: "status",
      options: statusChoices,
    }),
    setColumns.number((row) => row.questionCount, {
      header: tCommon("exam-questions"),
      id: "questionCount",
    }),
    setColumns.number((row) => row.durationSeconds / SECONDS_IN_MINUTE, {
      cell: (info) => t("set-duration-minutes", { minutes: info.getValue() }),
      header: t("set-column-duration"),
      id: "durationSeconds",
    }),
    setColumns.number((row) => row.publishedScore, {
      cell: (info) => <span data-progress>{info.getValue()}</span>,
      header: t("set-column-score"),
      id: "publishedScore",
    }),
    setColumns.menu((info) => (
      <TryoutSetMenu publicPath={info.row.original.publicPath} />
    )),
  ];
}

/** What a set's row offers: Open, or Close when the set is already open beside the table. */
function TryoutSetMenu({ publicPath }: { publicPath: string }) {
  const common = useTranslations("Common");
  const { shown } = useTryoutSetTable();
  const isShown = Option.contains(shown, publicPath);

  return (
    <RowItems>
      <RowOpen
        icon={isShown ? Cancel01Icon : ViewIcon}
        label={common(isShown ? "close" : "open")}
      />
    </RowItems>
  );
}

/**
 * A set's name, the link the row presses, after the mark that its latest attempt is complete. It opens the set at its
 * own address, which the track shows in the pane beside the table, and pressing the open set again closes the pane back
 * to the track while keeping the table's selection and scroll. The link stays a real link for a new tab and crawlers.
 */
function TryoutSetName({ row }: { row: TryoutSetRow }) {
  const { onClose, shown } = useTryoutSetTable();
  const isShown = Option.contains(shown, row.publicPath);

  return Option.match(getTryoutPublicPathTarget(row.publicPath), {
    onNone: () => null,
    onSome: (target) => (
      <Link
        {...target}
        aria-current={isShown ? "page" : undefined}
        className="flex min-w-0 items-center gap-2 underline-offset-4 hover:underline"
        onClick={(event) => {
          if (
            isShown &&
            event.button === 0 &&
            !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          ) {
            event.preventDefault();
            onClose();
          }
        }}
        preload={isShown ? false : "intent"}
        resetScroll={false}
        search={catalogSearchOf}
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full border",
            row.attemptStatus === "completed"
              ? "bg-secondary text-secondary-foreground border-transparent"
              : "border-muted-foreground/40"
          )}
          data-progress
        >
          {row.attemptStatus === "completed" && (
            <HugeIcons icon={CheckmarkCircle02Icon} />
          )}
        </span>
        <span className="truncate" title={row.title}>
          {row.title}
        </span>
      </Link>
    ),
  });
}

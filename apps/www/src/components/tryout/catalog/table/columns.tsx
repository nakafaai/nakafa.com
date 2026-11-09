import {
  CheckmarkCircle02Icon,
  Menu01Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { setFilterValidator } from "@repo/backend/confect/tryouts/sets/query";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "cn";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { tableColumns } from "@/components/shared/table/columns";
import { RowItems, RowOpen } from "@/components/shared/table/menu";
import type {
  TryoutSetRow,
  TryoutSetStatusFilter,
} from "@/components/tryout/catalog/table/types";
import { statusLook } from "@/components/tryout/progress";
import { TryoutPageLink } from "@/components/tryout/route/link";
import type { TryoutPageAddress } from "@/components/tryout/route/path";
import { TryoutStatus } from "@/components/tryout/status";

/** The seconds of one minute, the unit the duration column prints and filters by. */
const SECONDS_IN_MINUTE = 60;

/** The columns of a track's sets. */
const setColumns = tableColumns<TryoutSetRow>();

/**
 * Opens a set, or the page its running attempt continues on directly: through the public set the learner would pass a
 * second page on the way.
 */
function setAddress(row: TryoutSetRow): TryoutPageAddress {
  return row.runningAttempt
    ? {
        attemptId: row.runningAttempt.attemptId,
        publicPath: row.runningAttempt.publicPath,
      }
    : { publicPath: row.publicPath };
}

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
 * The columns of a track's sets: the name, which opens the set, the learner's status, which the server filters by, the
 * questions, the minutes and the score. The server sorts the track by the name and the figures; the heads of text and
 * figures keep the sets the table has read. A learner's progress marks carry `data-progress`, so the rows every visitor
 * reads can hide them under a signed-in hint.
 */
export function useTryoutSetColumns() {
  const t = useTranslations("Tryouts");
  const tCommon = useTranslations("Common");
  const statusChoices = useStatusChoices();

  return [
    setColumns.text((row) => row.title, {
      cell: (info) => <TryoutSetName row={info.row.original} />,
      header: tCommon("name"),
      id: "title",
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
    setColumns.menu(() => <TryoutSetMenu />),
  ];
}

/** What a set's row offers: Open, which presses the row's link. */
function TryoutSetMenu() {
  const common = useTranslations("Common");

  return (
    <RowItems>
      <RowOpen icon={ViewIcon} label={common("open")} />
    </RowItems>
  );
}

/** A set's name, the link the row presses, after the mark that its latest attempt is complete. */
function TryoutSetName({ row }: { row: TryoutSetRow }) {
  return (
    <TryoutPageLink
      className="flex min-w-0 items-center gap-2 underline-offset-4 hover:underline"
      preload="intent"
      {...setAddress(row)}
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
          <HugeIcons className="size-4" icon={CheckmarkCircle02Icon} />
        )}
      </span>
      <span className="truncate" title={row.title}>
        {row.title}
      </span>
    </TryoutPageLink>
  );
}

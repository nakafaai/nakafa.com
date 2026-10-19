"use client";

import { QueryResult, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import { cva } from "class-variance-authority";
import { Array as Arr } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import {
  type DashboardAttempt,
  dashboardArgs,
} from "@/components/exams/sitting/change";
import {
  useSittingData,
  useSittingStore,
} from "@/components/exams/sitting/context";
import {
  isDisconnected,
  lastActivityOf,
  matchesFilter,
  type SeatFrame,
  seatFrame,
} from "@/components/exams/sitting/seat";
import { schoolDateTimeText } from "@/components/tenant/settings/clock";

/** The frame of one seat: its colour by state, dashed while the student is disconnected, and a ring when selected. */
const seatStyles = cva(
  "grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-xl border bg-card p-2.5 text-start text-sm transition-colors",
  {
    variants: {
      dashed: {
        false: "",
        true: "border-dashed",
      },
      frame: {
        away: "border-warning/70 bg-warning/10",
        locked: "border-destructive/60 bg-destructive/10",
        plain: "border-border",
        submitted: "border-success/70 bg-success/10",
      } satisfies Record<SeatFrame, string>,
      selected: {
        false: "",
        true: "ring-1 ring-ring",
      },
    },
  }
);

/**
 * The seats of the students that the filter keeps, a page of attempts at a time: the first
 * page comes with the dashboard, and each further page loads once the end of the seats comes
 * into view, so every student of a large sitting gets a seat. A seat shows its student's
 * animal and name, and its state by colour and line, never by a sentence.
 */
export function SittingSeats() {
  const t = useTranslations("Exams");
  const { value } = useSittingData();
  const filter = useSittingStore((state) => state.filter);
  const first = value.attempts;

  if (first.isDone && Arr.isReadonlyArrayEmpty(first.page)) {
    return <p className="text-muted-foreground text-sm">{t("seats-empty")}</p>;
  }
  if (
    first.isDone &&
    !Arr.some(first.page, (attempt) => matchesFilter(filter, attempt))
  ) {
    return <p className="text-muted-foreground text-sm">{t("filter-empty")}</p>;
  }

  return (
    <ul
      aria-label={t("seats-label")}
      className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-2"
    >
      <SeatPage attempts={first.page} cursor={null} />
      {first.isDone ? null : <NextSeats cursor={first.continueCursor} />}
    </ul>
  );
}

/** The seats of one page of attempts that the filter keeps. */
function SeatPage({
  attempts,
  cursor,
}: {
  readonly attempts: readonly DashboardAttempt[];
  readonly cursor: string | null;
}) {
  const filter = useSittingStore((state) => state.filter);

  return Arr.map(
    Arr.filter(attempts, (attempt) => matchesFilter(filter, attempt)),
    (attempt) => (
      <li key={attempt.id}>
        <SeatButton attempt={attempt} cursor={cursor} />
      </li>
    )
  );
}

/**
 * The page of attempts that starts at `cursor`, loaded once the end of the seats comes into
 * view, then the page after it in the same way, until the sitting has no more attempts.
 */
function NextSeats({ cursor }: { readonly cursor: string }) {
  const { sittingId, slug } = useSittingData();
  const [reached, setReached] = useState(false);
  const page = useQuery(
    exams.sittings.dashboard,
    reached ? dashboardArgs({ sittingId, slug }, cursor) : "skip"
  );

  if (!reached) {
    return (
      <li aria-hidden className="col-span-full">
        <Intersection onIntersect={() => setReached(true)} />
      </li>
    );
  }
  if (!QueryResult.isSuccess(page)) {
    return null;
  }

  return (
    <>
      <SeatPage attempts={page.value.attempts.page} cursor={cursor} />
      {page.value.attempts.isDone ? null : (
        <NextSeats cursor={page.value.attempts.continueCursor} />
      )}
    </>
  );
}

/**
 * One student's seat. It opens the student's panel when the proctor selects it. The seat reads its own
 * latest answer, so an answer re-runs this seat's query and not the page that holds it.
 */
function SeatButton({
  attempt,
  cursor,
}: {
  readonly attempt: DashboardAttempt;
  readonly cursor: string | null;
}) {
  const t = useTranslations("Exams");
  const locale = useLocale();
  const { sittingId, slug, value } = useSittingData();
  const answered = useQuery(exams.sittings.lastAnswer, {
    attemptId: attempt.id,
    sittingId,
    slug,
  });
  const selected = useSittingStore(
    (state) => state.selected?.attemptId === attempt.id
  );
  const choose = useSittingStore((state) => state.choose);

  return (
    <button
      aria-pressed={selected}
      className={seatStyles({
        dashed: isDisconnected(attempt),
        frame: seatFrame(attempt),
        selected,
      })}
      data-frame={seatFrame(attempt)}
      onClick={() => choose({ attemptId: attempt.id, cursor })}
      type="button"
    >
      <PersonAvatar className="size-6" mascot={attempt.mascot ?? undefined} />
      <span className="grid min-w-0 gap-0.5">
        <span className="truncate">{attempt.name}</span>
        <span className="truncate text-muted-foreground text-xs">
          {t("seat-last-activity", {
            time:
              schoolDateTimeText({
                at: lastActivityOf(
                  attempt,
                  QueryResult.isSuccess(answered) ? answered.value : null
                ),
                locale,
                timeZone: value.sitting.timeZone,
              }) ?? "",
          })}
        </span>
      </span>
    </button>
  );
}

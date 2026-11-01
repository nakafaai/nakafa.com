import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import { rowLineVariants } from "@repo/design-system/lib/row";
import { getRouteApi } from "@tanstack/react-router";
import { cva } from "class-variance-authority";
import { Array as Arr, Option } from "effect";
import { type ReactNode, use, useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import {
  type DashboardAttempt,
  dashboardArgs,
} from "@/components/exams/sitting/change";
import {
  SittingOfflineContext,
  useSittingData,
  useSittingStore,
} from "@/components/exams/sitting/context";
import {
  awaySince,
  awayTime,
  isDisconnected,
  lastActivityOf,
  matchesFilter,
  type SeatFrame,
  seatFrame,
  seatTimeKey,
  seenOffline,
} from "@/components/exams/sitting/seat";
import { useSittingClock } from "@/components/exams/sitting/timer";
import { TableEmpty } from "@/components/shared/table/frame";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { schoolTimeText } from "@/components/tenant/settings/clock";
import { Link } from "@/lib/routing/link";

/** The proctor's dashboard, whose address holds the seat the proctor selected. */
const dashboardRoute = getRouteApi(
  "/school/$slug/exams/$exam/sittings/$sitting/"
);

/** The frame of one seat: its colour by state, dashed while the student is disconnected, and a ring when selected. */
const seatStyles = cva(
  "bg-card grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-xl border p-2.5 text-start text-sm transition-colors",
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
        true: "ring-ring ring-1",
      },
      waiting: {
        false: "",
        true: "border-border bg-muted/40 text-muted-foreground",
      },
    },
  }
);

/** How many expected students one page of the seats loads, and each page after it. */
const EXPECTED_PAGE = 100;

/**
 * The seats of the students that the filter keeps, a page of attempts at a time: the first
 * page comes with the dashboard, and each further page loads once the end of the seats comes
 * into view, so every student of a large sitting gets a seat. A seat shows its student's
 * animal and name, and its state by colour and line, never by a sentence.
 */
export function SittingSeats() {
  const t = useTranslations("Exams");
  const { sittingId, slug, value } = useSittingData();
  const filter = useSittingStore((state) => state.filter);
  const offline = use(SittingOfflineContext);
  const first = value.attempts;
  // The students who have not entered yet hold a seat too, once every attempt is listed, and
  // only the "all" filter shows them, because they have no state to filter by.
  const expected = usePaginatedQuery(
    exams.sittings.expected,
    { sittingId, slug },
    { initialNumItems: EXPECTED_PAGE }
  );
  const showExpected = filter === "all" && first.isDone;
  const noExpected =
    expected._tag === "Exhausted" && Arr.isReadonlyArrayEmpty(expected.results);

  if (first.isDone && Arr.isReadonlyArrayEmpty(first.page) && noExpected) {
    return (
      <TableEmpty
        act="sleeping"
        description={t("seats-empty")}
        title={t("seats-empty-title")}
      />
    );
  }
  if (
    first.isDone &&
    !Arr.some(first.page, (attempt) =>
      matchesFilter(filter, seenOffline(attempt, offline))
    ) &&
    !(showExpected && !noExpected)
  ) {
    return (
      <TableEmpty
        act="searching"
        description={t("filter-empty")}
        title={t("seats-filter-title")}
      />
    );
  }

  return (
    <ul
      aria-label={t("seats-label")}
      className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-2"
    >
      <SeatPage attempts={first.page} cursor={null} />
      {first.isDone ? null : (
        <NextSeats>
          <NextSeatsPage cursor={first.continueCursor} />
        </NextSeats>
      )}
      {showExpected
        ? Arr.map(expected.results, (seat) => (
            <li key={seat.id}>
              <ExpectedSeatCard mascot={seat.mascot} name={seat.name} />
            </li>
          ))
        : null}
      {showExpected && PaginatedQueryResult.isCanLoadMore(expected) ? (
        <li aria-hidden className="col-span-full">
          <Intersection onIntersect={() => expected.loadMore(EXPECTED_PAGE)} />
        </li>
      ) : null}
    </ul>
  );
}

/**
 * The seat of a student who has not entered the sitting yet: the animal and the name, in a muted
 * frame, with no action, because the student has no attempt to open.
 */
function ExpectedSeatCard({
  mascot,
  name,
}: {
  readonly mascot: PaginatedQueryItem<typeof exams.sittings.expected>["mascot"];
  readonly name: string;
}) {
  const t = useTranslations("Exams");

  return (
    <div
      className={seatStyles({
        dashed: false,
        frame: "plain",
        selected: false,
        waiting: true,
      })}
    >
      <PersonAvatar className="size-6" mascot={mascot ?? undefined} />
      <span className="min-w-0 truncate">{name}</span>
      <span className="sr-only">{t("seat-waiting")}</span>
    </div>
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
  const offline = use(SittingOfflineContext);

  return Arr.map(
    Arr.filter(
      Arr.map(attempts, (attempt) => seenOffline(attempt, offline)),
      (attempt) => matchesFilter(filter, attempt)
    ),
    (attempt) => (
      <li key={attempt.id}>
        <SeatLink attempt={attempt} cursor={cursor} />
      </li>
    )
  );
}

/**
 * The page of attempts the caller composes, mounted once the end of the seats comes into view; that page
 * holds the page after it in the same way, until the sitting has no more attempts.
 */
function NextSeats({ children }: { readonly children: ReactNode }) {
  const [reached, setReached] = useState(false);

  if (!reached) {
    return (
      <li aria-hidden className="col-span-full">
        <Intersection onIntersect={() => setReached(true)} />
      </li>
    );
  }
  return children;
}

/** One page of seats after the first, which a failed read shows as its own sentence with Try again. */
function NextSeatsPage({ cursor }: { readonly cursor: string }) {
  const { sittingId, slug } = useSittingData();

  return (
    <ReadBoundary
      fallback={(failure) => <li className="col-span-full">{failure}</li>}
      read={{
        args: dashboardArgs({ sittingId, slug }, cursor),
        ref: exams.sittings.dashboard,
      }}
    >
      <NextSeatsReady cursor={cursor} />
    </ReadBoundary>
  );
}

/** The page of seats after the first once its read is in, with the page after it. */
function NextSeatsReady({ cursor }: { readonly cursor: string }) {
  const { sittingId, slug } = useSittingData();
  const page = useQuery(
    exams.sittings.dashboard,
    dashboardArgs({ sittingId, slug }, cursor)
  );

  if (QueryResult.isFailure(page)) {
    throw page.error;
  }
  if (!QueryResult.isSuccess(page)) {
    return null;
  }

  return (
    <>
      <SeatPage attempts={page.value.attempts.page} cursor={cursor} />
      {page.value.attempts.isDone ? null : (
        <NextSeats>
          <NextSeatsPage cursor={page.value.attempts.continueCursor} />
        </NextSeats>
      )}
    </>
  );
}

/**
 * One student's seat, a link to the dashboard with the seat in its address, so a press opens the
 * student's panel even before the page's script runs: the browser loads the address, and the page
 * opens with the panel. Once the page runs, the router changes the address in place. Only the
 * selected seat matches the address, so it is the current link. The seat reads its own latest
 * answer, so an answer re-runs this seat's query and not the page that holds it.
 */
function SeatLink({
  attempt,
  cursor,
}: {
  readonly attempt: DashboardAttempt;
  readonly cursor: string | null;
}) {
  const t = useTranslations("Exams");
  const locale = useLocale();
  const { sittingId, slug, value } = useSittingData();
  const params = dashboardRoute.useParams();
  const answered = useQuery(exams.sittings.lastAnswer, {
    attemptId: attempt.id,
    sittingId,
    slug,
  });
  const selected = dashboardRoute.useSearch({
    select: (search) => search.seat === attempt.id,
  });
  const warm = useSittingStore((state) => state.warm);
  const onWarm = () => warm({ attemptId: attempt.id, cursor });

  return (
    <Link
      activeOptions={{ exact: true, includeSearch: true }}
      className={seatStyles({
        dashed: isDisconnected(attempt),
        frame: seatFrame(attempt),
        selected,
      })}
      data-frame={seatFrame(attempt)}
      onFocus={onWarm}
      onPointerDown={onWarm}
      onPointerEnter={onWarm}
      params={params}
      replace
      resetScroll={false}
      search={{ page: cursor ?? undefined, seat: attempt.id }}
      to="/school/$slug/exams/$exam/sittings/$sitting"
    >
      <PersonAvatar className="size-6" mascot={attempt.mascot ?? undefined} />
      <span className="grid min-w-0 gap-0.5">
        <span className={rowLineVariants()}>{attempt.name}</span>
        <span className={rowLineVariants({ line: "fact" })}>
          {Option.match(awaySince(attempt), {
            onNone: () =>
              t(seatTimeKey(attempt), {
                time:
                  schoolTimeText({
                    at: lastActivityOf(
                      attempt,
                      QueryResult.isSuccess(answered) ? answered.value : null
                    ),
                    locale,
                    timeZone: value.sitting.timeZone,
                  }) ?? "",
              }),
            onSome: (since) => <SeatAway since={since} />,
          })}
        </span>
      </span>
    </Link>
  );
}

/**
 * How long an away seat's student has been gone, counted each second from the exit or disconnect that no return
 * followed, in the line where a present student's last activity stands.
 */
function SeatAway({ since }: { readonly since: number }) {
  const t = useTranslations("Exams");
  const { minutes, seconds } = awayTime(since, useSittingClock());

  return minutes === 0
    ? t("seat-away-seconds", { seconds })
    : t("seat-away-minutes", { minutes, seconds });
}

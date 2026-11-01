import type { GenericId } from "@confect/core";
import {
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import {
  Calendar03Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Door01Icon,
  PencilEdit02Icon,
  PlayIcon,
  SchoolIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { RoomRow } from "@repo/backend/confect/exams/rooms";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr, Option, Schema } from "effect";
import { useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import type { BreadcrumbHeaderItem } from "@/components/shared/breadcrumb/header";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { chosenOne } from "@/components/shared/table/filter";
import { TableEmpty, TablePageBody } from "@/components/shared/table/frame";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import { TableTitle } from "@/components/shared/table/title";
import {
  TableFiltersProvider,
  TableSearch,
  useServerSearch,
  useTableFilters,
} from "@/components/shared/table/toolbar";
import { LoadFailure } from "@/components/state/failure";
import { useTenant } from "@/components/tenant/context";
import {
  RoomStateFilter,
  roomGroupKey,
  roomGroups,
  roomsArgs,
} from "@/components/tenant/exams/filter";
import { RoomMenu } from "@/components/tenant/exams/move";
import { RoomSeats } from "@/components/tenant/exams/seats";
import { ExamGone } from "@/components/tenant/exams/unavailable";
import { SchoolHeader } from "@/components/tenant/header";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { isDenied, isLostAccess } from "@/components/tenant/refusal";
import { schoolDateTimeText } from "@/components/tenant/settings/clock";
import { useKeptRows, useLastValue } from "@/lib/data/kept";
import { Link } from "@/lib/routing/link";
import { schoolExamsTarget } from "@/lib/routing/school/target";

/** One room of the exam as the list holds it. */
type Room = typeof RoomRow.Type;

/** The state the table filters by, which is every state or one of them. */
type StateFilter = typeof RoomStateFilter.Type;

/** The states of a room, in the order the state column's choice lists them after every state. */
const ROOM_STATES = Arr.filter(
  RoomStateFilter.literals,
  (state): state is Exclude<StateFilter, "all"> => state !== "all"
);

/**
 * The look of each room state, in its table cell and in its column's filter: a clock before it opens,
 * a running room, and a closed one, each in its tone.
 */
const ROOM_STATE_LOOKS = {
  closed: { icon: CheckmarkCircle02Icon, tone: "neutral" },
  open: { icon: PlayIcon, tone: "success" },
  scheduled: { icon: Clock01Icon, tone: "info" },
} as const satisfies Record<Room["state"], StatusLook>;

/** How many rooms each page asks for. The next page loads when the end of the table comes into view. */
const ROOM_PAGE_SIZE = 20;

/**
 * The rooms of one exam: its title in the header, the state filter, and a table of its rooms in
 * their opening order. Each room links to its proctor dashboard. A viewer the exam refuses sees
 * the header and why, so the page never shows another school's rooms or a part of them. A failed
 * read keeps the header, and offers Try again in place of the page, and a viewer who lost the
 * school's access is sent to the refused page.
 */
export function ExamRooms({
  examId,
  slug,
}: {
  examId: GenericId.GenericId<"exams">;
  slug: TenantSlug;
}) {
  const tenant = useTenant();
  // The exam list is for the exam editors only, so a viewer who reads rooms alone gets no link to it.
  const examsItems = useExamsItems(tenant.canOpenExams);

  return (
    <ReadBoundary
      fallback={(failure) => (
        <>
          <SchoolHeader items={examsItems} />
          <TablePageBody>{failure}</TablePageBody>
        </>
      )}
      read={{ args: { examId, slug }, ref: exams.rooms.exam }}
    >
      <ExamRoomsContent examId={examId} slug={slug} />
    </ReadBoundary>
  );
}

/** The exam list's crumb of the rooms page, which only a viewer who may open the list has. */
function useExamsItems(canOpenExams: boolean): readonly BreadcrumbHeaderItem[] {
  const t = useTranslations("Exams");
  const tenant = useTenant();
  return canOpenExams
    ? [{ label: t("title"), target: schoolExamsTarget(tenant.slug) }]
    : [];
}

/**
 * The rooms page: its header with the path, Edit and the table from the first paint, and the exam's title in the path's
 * last crumb once the exam's summary is in. The crumb stands empty until then, so the header keeps one shape.
 */
function ExamRoomsContent({
  examId,
  slug,
}: {
  examId: GenericId.GenericId<"exams">;
  slug: TenantSlug;
}) {
  const t = useTranslations("Exams");
  const tenant = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const summary = useQuery(
    exams.rooms.exam,
    isSettled ? { examId, slug } : "skip"
  );
  const examsItems = useExamsItems(tenant.canOpenExams);
  // An exam deleted, or closed to the viewer, while its rooms are open keeps its title and says so.
  const kept = useLastValue(summary);

  if (QueryResult.isFailure(summary)) {
    if (isLostAccess(summary.error)) {
      throw summary.error;
    }
    if (!isDenied(summary.error)) {
      throw summary.error;
    }
    return Option.match(kept, {
      onNone: () => (
        <>
          <SchoolHeader items={examsItems} />
          <TablePageBody>
            <p className="text-muted-foreground p-4 text-sm md:p-6">
              {t("rooms-unavailable")}
            </p>
          </TablePageBody>
        </>
      ),
      onSome: (gone) => (
        <>
          <SchoolHeader
            items={[...examsItems, { label: gone.title }]}
            title={gone.title}
          />
          <TablePageBody>
            <p className="text-muted-foreground p-4 text-sm md:p-6">
              <ExamGone />
            </p>
          </TablePageBody>
        </>
      ),
    });
  }
  const title = QueryResult.isSuccess(summary)
    ? Option.some(summary.value.title)
    : Option.none();

  return (
    <TableFiltersProvider>
      <SchoolHeader
        // The title's crumb stands from the first paint, empty until the summary is in, so the exam list's crumb is
        // a link and the phone's folded path stands from the start, and the header's controls never change.
        items={[...examsItems, { label: Option.getOrElse(title, () => "") }]}
        {...Option.match(title, {
          onNone: () => ({}),
          onSome: (label) => ({ title: label }),
        })}
      >
        <TableSearch placeholder={t("rooms-search")} />
        {tenant.canOpenExams ? (
          <Link
            className={buttonVariants({ variant: "outline" })}
            params={{ exam: examId, slug }}
            to="/school/$slug/exams/$exam/edit"
          >
            <HugeIcons icon={PencilEdit02Icon} />
            <span className="@max-sm/header:sr-only">{t("edit-action")}</span>
          </Link>
        ) : null}
      </SchoolHeader>
      <TablePageBody>
        <RoomsTable examId={examId} isSettled={isSettled} slug={slug} />
      </TablePageBody>
    </TableFiltersProvider>
  );
}

/** The columns of the rooms table. */
const roomColumns = tableColumns<Room>();

/**
 * The rooms in a table that loads more rows as its end comes into view, its state column choosing the state the server
 * reads and the header's search the room names it reads (`useServerSearch`). The table waits for its first page, so no
 * empty state shows before the rows arrive. A page can hold no room the viewer may see, so an empty page keeps the end
 * in view until the list is exhausted, and only then does the table say why it is empty: an exam with no room yet shows
 * its empty state alone, and a chosen state or a search with no room keeps the table's head, so the choice stays in
 * reach, above one sentence.
 */
function RoomsTable({
  examId,
  isSettled,
  slug,
}: {
  examId: GenericId.GenericId<"exams">;
  isSettled: boolean;
  slug: TenantSlug;
}) {
  const t = useTranslations("Exams");
  const locale = useLocale();
  const chosen = useTableFilters((state) => state.chosen);
  const filter = Option.getOrElse(
    chosenOne(chosen, "state", Schema.is(RoomStateFilter)),
    (): StateFilter => "all"
  );
  const search = useServerSearch();
  const pagination = usePaginatedQuery(
    exams.rooms.list,
    isSettled ? roomsArgs({ examId, slug }, filter, search) : "skip",
    { initialNumItems: ROOM_PAGE_SIZE }
  );
  // A new filter's first page loads behind the rooms the table already shows, so the table never blanks.
  const loading = pagination._tag === "LoadingFirstPage";
  const kept = useKeptRows(loading, pagination.results);

  if (
    PaginatedQueryResult.isFailure(pagination) &&
    isLostAccess(pagination.error)
  ) {
    throw pagination.error;
  }
  const rooms = Option.getOrElse(kept, Arr.empty);
  const failed = PaginatedQueryResult.isFailure(pagination);
  const loadMore = PaginatedQueryResult.isCanLoadMore(pagination)
    ? () => pagination.loadMore(ROOM_PAGE_SIZE)
    : null;
  if (Arr.isReadonlyArrayEmpty(rooms) && failed) {
    return <LoadFailure onRetry={reloadPage} />;
  }

  return (
    <>
      {failed ? <DataFailure onRetry={reloadPage} /> : null}
      <DataTable
        columns={[
          roomColumns.text((room) => room.room, {
            cell: (info) => (
              <TableTitle
                icon={Door01Icon}
                tone={ROOM_STATE_LOOKS[info.row.original.state].tone}
              >
                <Link
                  className="underline-offset-4 hover:underline"
                  dir="auto"
                  params={{ exam: examId, slug, sitting: info.row.original.id }}
                  to="/school/$slug/exams/$exam/sittings/$sitting"
                >
                  {info.getValue()}
                </Link>
              </TableTitle>
            ),
            header: t("room"),
            id: "room",
          }),
          roomColumns.choice((room) => roomGroupKey(room.group), {
            cell: (info) => (
              <span dir="auto">{info.row.original.groupName}</span>
            ),
            header: t("rooms-group"),
            id: "group",
            options: [
              { icon: UserGroupIcon, label: t("group-all"), value: "all" },
              ...Arr.map(roomGroups(rooms), (option) => ({
                icon: option.kind === "cohort" ? UserGroupIcon : SchoolIcon,
                label: option.name,
                value: option.key,
              })),
            ],
          }),
          roomColumns.days((room) => room.opensAt, {
            cell: (info) => (
              <span className="text-muted-foreground tabular-nums">
                {schoolDateTimeText({
                  at: info.getValue(),
                  locale,
                  timeZone: info.row.original.timeZone,
                })}
              </span>
            ),
            header: t("rooms-opens"),
            id: "opens",
            timeZone: (room) => room.timeZone,
          }),
          roomColumns.days((room) => room.closesAt, {
            cell: (info) => (
              <span className="text-muted-foreground tabular-nums">
                {schoolDateTimeText({
                  at: info.getValue(),
                  locale,
                  timeZone: info.row.original.timeZone,
                })}
              </span>
            ),
            header: t("rooms-closes"),
            id: "closes",
            timeZone: (room) => room.timeZone,
          }),
          roomColumns.choice((room) => room.state, {
            cell: (info) => (
              <span className="inline-flex items-center gap-2">
                <TableStatus
                  icon={ROOM_STATE_LOOKS[info.getValue()].icon}
                  label={t(`room-state-${info.getValue()}`)}
                  tone={ROOM_STATE_LOOKS[info.getValue()].tone}
                />
                {info.getValue() === "open" ? (
                  <RoomSeats sittingId={info.row.original.id} slug={slug} />
                ) : null}
              </span>
            ),
            header: t("rooms-state"),
            id: "state",
            options: [
              { icon: Calendar03Icon, label: t("state-all"), value: "all" },
              ...Arr.map(ROOM_STATES, (state) => ({
                icon: ROOM_STATE_LOOKS[state].icon,
                label: t(`room-state-${state}`),
                value: state,
              })),
            ],
          }),
          roomColumns.menu((info) => (
            <RoomMenu examId={examId} room={info.row.original} slug={slug} />
          )),
        ]}
        data={rooms}
        empty={
          filter === "all" && search === "" ? (
            <TableEmpty
              act="pointing"
              description={t("rooms-empty-description")}
              title={t("rooms-empty")}
            />
          ) : (
            <TableEmpty
              act="searching"
              description={t("rooms-filter-empty-description")}
              title={t("rooms-filter-empty")}
            />
          )
        }
        loading={!PaginatedQueryResult.isExhausted(pagination)}
        rowId={(room) => room.id}
      />
      {loadMore === null ? null : <Intersection onIntersect={loadMore} />}
    </>
  );
}

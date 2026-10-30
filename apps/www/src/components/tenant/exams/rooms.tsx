import type { GenericId } from "@confect/core";
import {
  PaginatedQueryResult,
  QueryResult,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import {
  Calendar03Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  PlayIcon,
} from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { RoomRow } from "@repo/backend/confect/exams/rooms";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr, Option, Schema } from "effect";
import { startTransition } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { ColumnChoice } from "@/components/shared/table/column";
import { ConfirmRowMenu } from "@/components/shared/table/confirm";
import { chosenOne } from "@/components/shared/table/filter";
import { TableEmpty, TablePageBody } from "@/components/shared/table/frame";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import {
  TableFiltersProvider,
  useTableFilters,
} from "@/components/shared/table/toolbar";
import { useTenant } from "@/components/tenant/context";
import {
  cancelRoomChange,
  RoomStateFilter,
  roomsArgs,
} from "@/components/tenant/exams/filter";
import { ExamGone } from "@/components/tenant/exams/unavailable";
import { SchoolHeader } from "@/components/tenant/header";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { isDenied, isLostAccess } from "@/components/tenant/refusal";
import { schoolDateTimeText } from "@/components/tenant/settings/clock";
import { saveSchool } from "@/components/tenant/settings/save";
import { useLastValue } from "@/lib/data/kept";
import { Link } from "@/lib/routing/link";

const SOURCE = "components/tenant/exams/rooms";

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
function useExamsItems(canOpenExams: boolean) {
  const t = useTranslations("Exams");
  return canOpenExams ? [{ href: "/exams", label: t("title") }] : [];
}

/** The rooms page once the exam's summary is in: the header with the exam's title, and the table. */
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
            <p className="p-4 text-muted-foreground text-sm md:p-6">
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
            <p className="p-4 text-muted-foreground text-sm md:p-6">
              <ExamGone />
            </p>
          </TablePageBody>
        </>
      ),
    });
  }
  if (!QueryResult.isSuccess(summary)) {
    return null;
  }

  return (
    <TableFiltersProvider>
      <SchoolHeader
        items={[...examsItems, { label: summary.value.title }]}
        title={summary.value.title}
      >
        {tenant.canOpenExams ? (
          <Link
            className={buttonVariants({ variant: "outline" })}
            params={{ exam: examId, slug }}
            to="/school/$slug/exams/$exam/edit"
          >
            {t("edit-action")}
          </Link>
        ) : null}
      </SchoolHeader>
      <TablePageBody>
        <RoomsTable examId={examId} isSettled={isSettled} slug={slug} />
      </TablePageBody>
    </TableFiltersProvider>
  );
}

/**
 * The rooms in a table that loads more rows as its end comes into view, its state column choosing the state the server
 * reads. The table waits for its first page, so no empty state shows before the rows arrive. A page can hold no room
 * the viewer may see, so an empty page keeps the end in view until the list is exhausted, and only then does the table
 * say why it is empty: an exam with no room yet shows its empty state alone, and a chosen state with no room keeps the
 * table's head, so its choice stays in reach, above one sentence.
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
  const chosen = useTableFilters((state) => state.chosen);
  const filter = Option.getOrElse(
    chosenOne(chosen, "state", Schema.is(RoomStateFilter)),
    (): StateFilter => "all"
  );
  const pagination = usePaginatedQuery(
    exams.rooms.list,
    isSettled ? roomsArgs({ examId, slug }, filter) : "skip",
    { initialNumItems: ROOM_PAGE_SIZE }
  );

  if (
    PaginatedQueryResult.isFailure(pagination) &&
    isLostAccess(pagination.error)
  ) {
    throw pagination.error;
  }
  if (pagination._tag === "LoadingFirstPage") {
    return null;
  }
  const failed = PaginatedQueryResult.isFailure(pagination);
  const loadMore = PaginatedQueryResult.isCanLoadMore(pagination)
    ? () => pagination.loadMore(ROOM_PAGE_SIZE)
    : null;
  const empty = Arr.isReadonlyArrayEmpty(pagination.results);
  if (empty && failed) {
    return <DataFailure onRetry={reloadPage} />;
  }
  if (empty && pagination._tag !== "Exhausted") {
    return <RoomsMore loadMore={loadMore} />;
  }
  if (empty && filter === "all") {
    return (
      <TableEmpty
        act="pointing"
        description={t("rooms-empty-description")}
        title={t("rooms-empty")}
      />
    );
  }

  return (
    <>
      {failed ? <DataFailure onRetry={reloadPage} /> : null}
      <Table containerClassName="[&_[data-slot=table-cell]]:whitespace-nowrap">
        <TableHeader>
          <TableRow>
            <TableHead>{t("room")}</TableHead>
            <TableHead>{t("rooms-group")}</TableHead>
            <TableHead>{t("rooms-opens")}</TableHead>
            <TableHead>{t("rooms-closes")}</TableHead>
            <TableHead className="text-center">
              <ColumnChoice
                column="state"
                options={[
                  { icon: Calendar03Icon, label: t("state-all"), value: "all" },
                  ...Arr.map(ROOM_STATES, (state) => ({
                    icon: ROOM_STATE_LOOKS[state].icon,
                    label: t(`room-state-${state}`),
                    value: state,
                  })),
                ]}
                title={t("rooms-state")}
              />
            </TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {Arr.map(pagination.results, (room) => (
            <RoomItem examId={examId} key={room.id} room={room} slug={slug} />
          ))}
        </TableBody>
      </Table>
      {empty ? (
        <TableEmpty
          act="searching"
          description={t("rooms-filter-empty-description")}
          title={t("rooms-filter-empty")}
        />
      ) : null}
      <RoomsMore loadMore={loadMore} />
    </>
  );
}

/** The sentinel that reads the next page of rooms as it comes into view, while the list has more. */
function RoomsMore({ loadMore }: { loadMore: (() => void) | null }) {
  return loadMore === null ? null : <Intersection onIntersect={loadMore} />;
}

/**
 * One room of the table: its name, which opens its proctor dashboard, its group, its opening and
 * closing in the time zone of its unit, its state, and the menu that cancels a room that has not
 * opened yet.
 */
function RoomItem({
  examId,
  room,
  slug,
}: {
  examId: GenericId.GenericId<"exams">;
  room: Room;
  slug: TenantSlug;
}) {
  const t = useTranslations("Exams");
  const locale = useLocale();

  return (
    <TableRow>
      <TableCell className="font-medium">
        <Link
          className="underline-offset-4 hover:underline"
          dir="auto"
          params={{ exam: examId, slug, sitting: room.id }}
          to="/school/$slug/exams/$exam/sittings/$sitting"
        >
          {room.room}
        </Link>
      </TableCell>
      <TableCell dir="auto">{room.group.name}</TableCell>
      <TableCell className="text-muted-foreground">
        {schoolDateTimeText({
          at: room.opensAt,
          locale,
          timeZone: room.timeZone,
        })}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {schoolDateTimeText({
          at: room.closesAt,
          locale,
          timeZone: room.timeZone,
        })}
      </TableCell>
      <TableCell className="text-center">
        <TableStatus
          icon={ROOM_STATE_LOOKS[room.state].icon}
          label={t(`room-state-${room.state}`)}
          tone={ROOM_STATE_LOOKS[room.state].tone}
        />
      </TableCell>
      <TableCell>
        {room.canCancel ? <RoomMenu room={room} slug={slug} /> : null}
      </TableCell>
    </TableRow>
  );
}

/**
 * The row menu of a room that the viewer may cancel, which cancels it behind a confirmation. A
 * room that has opened, or closed, or that another Person scheduled, has no menu.
 */
function RoomMenu({ room, slug }: { room: Room; slug: TenantSlug }) {
  const t = useTranslations("Exams");
  const cancel = useMutation(exams.sittings.cancel).withOptimisticUpdate(
    cancelRoomChange
  );

  return (
    <ConfirmRowMenu
      action={t("room-cancel")}
      confirm={t("room-cancel-confirm")}
      description={t("room-cancel-description")}
      icon={Cancel01Icon}
      onConfirm={() =>
        startTransition(() =>
          saveSchool(() => cancel({ sittingId: room.id, slug }), SOURCE)
        )
      }
      title={t("room-cancel-title")}
    />
  );
}

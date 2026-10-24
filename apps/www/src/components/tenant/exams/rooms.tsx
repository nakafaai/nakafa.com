import type { GenericId } from "@confect/core";
import { PaginatedQueryResult, QueryResult, useMutation } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { RoomRow } from "@repo/backend/confect/exams/rooms";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
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
import { createContext, startTransition, use, useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/providers/convex";
import { LayoutContent } from "@/components/shared/content/frame";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { ConfirmRowMenu } from "@/components/shared/table/confirm";
import { TableEmpty, TableFrame } from "@/components/shared/table/frame";
import { useTenant } from "@/components/tenant/context";
import {
  cancelRoomChange,
  RoomStateFilter,
  roomsArgs,
} from "@/components/tenant/exams/filter";
import { SchoolHeader } from "@/components/tenant/header";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { isDenied, isLostAccess } from "@/components/tenant/refusal";
import { schoolDateTimeText } from "@/components/tenant/settings/clock";
import { saveSchool } from "@/components/tenant/settings/save";
import { usePaginatedPreloaded } from "@/lib/data/paginated";
import { usePreloadedQueryResult } from "@/lib/data/preloaded";
import { Link } from "@/lib/routing/link";
import type { readExamRoomsFn } from "@/lib/tenant/exams.functions";

const SOURCE = "components/tenant/exams/rooms";

/** One room of the exam as the list holds it. */
type Room = typeof RoomRow.Type;

/** The state the table filters by, which is every state or one of them. */
type StateFilter = typeof RoomStateFilter.Type;

/** How many rooms each page asks for. The next page loads when the end of the table comes into view. */
export const ROOM_PAGE_SIZE = 20;

/** The first screen of the rooms page, which its loader read on the server: the exam and the first page of its rooms. */
type ExamRoomsPreload = Pick<
  Awaited<ReturnType<typeof readExamRoomsFn>>,
  "rooms" | "summary"
>;

/** The first screen of the rooms page, which the page's loader read on the server. */
const ExamRoomsPreloadContext = createContext<ExamRoomsPreload | undefined>(
  undefined
);

/**
 * The rooms of one exam: its title in the header, the state filter, and a table of its rooms in
 * their opening order. Each room links to its proctor dashboard. A viewer the exam refuses sees
 * the header and why, so the page never shows another school's rooms or a part of them. A failed
 * read keeps the header, and offers Try again in place of the page, and a viewer who lost the
 * school's access is sent to the refused page.
 */
export function ExamRooms({
  examId,
  preload,
  slug,
}: {
  examId: GenericId.GenericId<"exams">;
  preload: ExamRoomsPreload | undefined;
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
          <LayoutContent className="py-6">{failure}</LayoutContent>
        </>
      )}
      read={{ args: { examId, slug }, ref: exams.rooms.exam }}
    >
      <ExamRoomsPreloadContext value={preload}>
        <ExamRoomsContent examId={examId} slug={slug} />
      </ExamRoomsPreloadContext>
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
  const preload = use(ExamRoomsPreloadContext);
  const t = useTranslations("Exams");
  const tenant = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const [filter, setFilter] = useState<StateFilter>("all");
  const summary = usePreloadedQueryResult(
    exams.rooms.exam,
    isSettled ? { examId, slug } : "skip",
    preload?.summary
  );
  const examsItems = useExamsItems(tenant.canOpenExams);

  if (QueryResult.isFailure(summary)) {
    if (isLostAccess(summary.error)) {
      throw summary.error;
    }
    if (isDenied(summary.error)) {
      return (
        <>
          <SchoolHeader items={examsItems} />
          <p className="p-4 text-muted-foreground text-sm md:p-6">
            {t("rooms-unavailable")}
          </p>
        </>
      );
    }
    throw summary.error;
  }
  if (!QueryResult.isSuccess(summary)) {
    return null;
  }

  return (
    <>
      <SchoolHeader
        items={[...examsItems, { label: summary.value.title }]}
        title={summary.value.title}
      />
      <LayoutContent className="flex w-full flex-col gap-4 py-6">
        <RoomStateSelect onValueChange={setFilter} value={filter} />
        <RoomsTable
          examId={examId}
          filter={filter}
          first={preload?.rooms}
          isSettled={isSettled}
          slug={slug}
        />
      </LayoutContent>
    </>
  );
}

/**
 * The empty state of the rooms table once the list is exhausted: no room yet, with the way to the
 * editor for a viewer who may open it, or no room in the chosen state.
 */
function RoomsEmpty({
  examId,
  filter,
}: {
  examId: GenericId.GenericId<"exams">;
  filter: StateFilter;
}) {
  const t = useTranslations("Exams");
  const tenant = useTenant();

  if (filter !== "all") {
    return (
      <TableEmpty
        act="searching"
        description={t("rooms-filter-empty-description")}
        title={t("rooms-filter-empty")}
      />
    );
  }
  return (
    <TableEmpty
      act="pointing"
      action={
        tenant.canOpenExams ? (
          <Link
            className={buttonVariants({ variant: "outline" })}
            params={{ exam: examId, slug: tenant.slug }}
            to="/school/$slug/exams/$exam/edit"
          >
            {t("rooms-empty-action")}
          </Link>
        ) : undefined
      }
      description={t("rooms-empty-description")}
      title={t("rooms-empty")}
    />
  );
}

/** The state filter of the table: every state, or one sitting state. */
function RoomStateSelect({
  onValueChange,
  value,
}: {
  onValueChange: (value: StateFilter) => void;
  value: StateFilter;
}) {
  const t = useTranslations("Exams");
  const items = [
    { label: t("state-all"), value: "all" },
    { label: t("room-state-scheduled"), value: "scheduled" },
    { label: t("room-state-open"), value: "open" },
    { label: t("room-state-closed"), value: "closed" },
  ];

  return (
    <Select
      items={items}
      onValueChange={(next) => {
        const chosen = Schema.decodeUnknownOption(RoomStateFilter)(next);
        if (Option.isSome(chosen)) {
          onValueChange(chosen.value);
        }
      }}
      value={value}
    >
      <SelectTrigger aria-label={t("rooms-state")} className="w-full max-w-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Arr.map(items, (item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * The rooms in a data table that loads more rows as its end comes into view. The table waits for
 * its first page, so no empty state shows before the rows arrive. A page can hold no room the
 * viewer may see, so an empty page keeps the end in view until the list is exhausted, and only
 * then does an empty table say why it is empty: no room yet, or no room in the chosen state.
 */
function RoomsTable({
  examId,
  filter,
  first,
  isSettled,
  slug,
}: {
  examId: GenericId.GenericId<"exams">;
  filter: StateFilter;
  first: ExamRoomsPreload["rooms"] | undefined;
  isSettled: boolean;
  slug: TenantSlug;
}) {
  const t = useTranslations("Exams");
  // The loader's first page is the page of the default filter, so a filtered table waits for its own first page.
  const pagination = usePaginatedPreloaded(
    exams.rooms.list,
    isSettled ? roomsArgs({ examId, slug }, filter) : "skip",
    { initialNumItems: ROOM_PAGE_SIZE },
    filter === "all" ? Option.fromUndefinedOr(first) : Option.none()
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
  const failure = PaginatedQueryResult.isFailure(pagination) ? (
    <DataFailure onRetry={reloadPage} />
  ) : null;
  const loadMoreTrigger = PaginatedQueryResult.isCanLoadMore(pagination) ? (
    <Intersection onIntersect={() => pagination.loadMore(ROOM_PAGE_SIZE)} />
  ) : null;
  if (Arr.isReadonlyArrayEmpty(pagination.results)) {
    if (failure !== null) {
      return failure;
    }
    if (pagination._tag !== "Exhausted") {
      return loadMoreTrigger;
    }
    return <RoomsEmpty examId={examId} filter={filter} />;
  }

  return (
    <>
      {failure}
      <TableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("room")}</TableHead>
              <TableHead>{t("rooms-group")}</TableHead>
              <TableHead>{t("rooms-opens")}</TableHead>
              <TableHead>{t("rooms-closes")}</TableHead>
              <TableHead>{t("rooms-state")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {Arr.map(pagination.results, (room) => (
              <RoomItem examId={examId} key={room.id} room={room} slug={slug} />
            ))}
          </TableBody>
        </Table>
      </TableFrame>
      {loadMoreTrigger}
    </>
  );
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
          params={{ exam: examId, slug, sitting: room.id }}
          to="/school/$slug/exams/$exam/sittings/$sitting"
        >
          {room.room}
        </Link>
      </TableCell>
      <TableCell>{room.group.name}</TableCell>
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
      <TableCell>{t(`room-state-${room.state}`)}</TableCell>
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
      onConfirm={() =>
        startTransition(() =>
          saveSchool(() => cancel({ sittingId: room.id, slug }), SOURCE)
        )
      }
      title={t("room-cancel-title")}
    />
  );
}

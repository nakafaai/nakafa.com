"use client";

import type { GenericId } from "@confect/core";
import {
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
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
import { Array as Arr, Option, Schema } from "effect";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useConvexAuth } from "@/components/providers/convex";
import { LayoutContent } from "@/components/shared/content/layout";
import { TableEmpty, TableFrame } from "@/components/shared/table/frame";
import { useTenant } from "@/components/tenant/context";
import {
  RoomStateFilter,
  roomsArgs,
} from "@/components/tenant/exams/rooms.client";
import { SchoolHeader } from "@/components/tenant/header";
import { schoolDateTimeText } from "@/components/tenant/settings/clock";

/** One room of the exam as the list holds it. */
type Room = typeof RoomRow.Type;

/** The state the table filters by, which is every state or one of them. */
type StateFilter = typeof RoomStateFilter.Type;

/** How many rooms each page asks for. The next page loads when the end of the table comes into view. */
const ROOM_PAGE_SIZE = 20;

/**
 * The rooms of one exam: its title in the header, the state filter, and a table of its rooms in
 * their opening order. Each room links to its proctor dashboard. A viewer the exam refuses sees
 * the header and why, so the page never shows another school's rooms or a part of them.
 */
export function ExamRooms({
  examId,
  slug,
}: {
  examId: GenericId.GenericId<"exams">;
  slug: TenantSlug;
}) {
  const t = useTranslations("Exams");
  const tenant = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const [filter, setFilter] = useState<StateFilter>("all");
  const summary = useQuery(
    exams.rooms.exam,
    isSettled ? { examId, slug } : "skip"
  );
  // The exam list is for the exam editors only, so a viewer who reads rooms alone gets no link to it.
  const examsItems = tenant.canOpenExams
    ? [{ href: "/exams", label: t("title") }]
    : [];

  if (QueryResult.isFailure(summary)) {
    return (
      <>
        <SchoolHeader items={examsItems} />
        <p className="p-4 text-muted-foreground text-sm md:p-6">
          {t("rooms-unavailable")}
        </p>
      </>
    );
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
          isSettled={isSettled}
          slug={slug}
        />
      </LayoutContent>
    </>
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
  isSettled,
  slug,
}: {
  examId: GenericId.GenericId<"exams">;
  filter: StateFilter;
  isSettled: boolean;
  slug: TenantSlug;
}) {
  const t = useTranslations("Exams");
  const locale = useLocale();
  const pagination = usePaginatedQuery(
    exams.rooms.list,
    isSettled ? roomsArgs({ examId, slug }, filter) : "skip",
    { initialNumItems: ROOM_PAGE_SIZE }
  );

  if (PaginatedQueryResult.isFailure(pagination)) {
    throw pagination.error;
  }
  if (pagination._tag === "LoadingFirstPage") {
    return null;
  }
  const loadMoreTrigger = PaginatedQueryResult.isCanLoadMore(pagination) ? (
    <Intersection onIntersect={() => pagination.loadMore(ROOM_PAGE_SIZE)} />
  ) : null;
  if (Arr.isReadonlyArrayEmpty(pagination.results)) {
    if (pagination._tag !== "Exhausted") {
      return loadMoreTrigger;
    }
    return filter === "all" ? (
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
    );
  }

  return (
    <>
      <TableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("room")}</TableHead>
              <TableHead>{t("rooms-group")}</TableHead>
              <TableHead>{t("rooms-opens")}</TableHead>
              <TableHead>{t("rooms-closes")}</TableHead>
              <TableHead>{t("rooms-state")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Arr.map(pagination.results, (room) => (
              <RoomItem
                examId={examId}
                key={room.id}
                locale={locale}
                room={room}
              />
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
 * closing in the time zone of its unit, and its state.
 */
function RoomItem({
  examId,
  locale,
  room,
}: {
  examId: GenericId.GenericId<"exams">;
  locale: string;
  room: Room;
}) {
  const t = useTranslations("Exams");

  return (
    <TableRow>
      <TableCell className="font-medium">
        <Link
          className="underline-offset-4 hover:underline"
          href={`/exams/${examId}/sittings/${room.id}`}
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
    </TableRow>
  );
}

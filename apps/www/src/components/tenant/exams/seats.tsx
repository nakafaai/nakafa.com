import type { GenericId } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import { useDocumentVisibility, useTimeout } from "@mantine/hooks";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { RoomSeats as RoomSeatCounts } from "@repo/backend/confect/exams/sittings/contract";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { cva } from "class-variance-authority";
import { Array as Arr, Option } from "effect";
import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { useLastValue } from "@/lib/data/kept";

/** How long a room's seats stand before the page reads them again (K26). */
const REFRESH_MILLISECONDS = 15_000;

/** The kinds of seat, in the order a room's dots show them. */
const SEAT_KINDS = [
  "finished",
  "working",
  "away",
  "offline",
  "locked",
] as const;

/** One seat of a room, in the colours of the proctor's seats: a line for a lost connection. */
const seatDot = cva("size-2 rounded-full", {
  variants: {
    kind: {
      away: "bg-warning",
      finished: "bg-success",
      locked: "bg-destructive",
      offline: "border-warning border border-dashed",
      working: "bg-muted-foreground/40",
    } satisfies Record<(typeof SEAT_KINDS)[number], string>,
  },
});

/** One dot for each seat, kind by kind, each named by its kind and its place. A kind with no seat draws none. */
const seatDots = (seats: typeof RoomSeatCounts.Type) =>
  Arr.flatMap(SEAT_KINDS, (kind) =>
    seats[kind] === 0
      ? []
      : Arr.map(Arr.replicate(kind, seats[kind]), (_, place) => ({
          id: `${kind}-${place}`,
          kind,
        }))
  );

/**
 * How one open room's seats stand, read once every 15 seconds while the page shows. The read reads every seat of the
 * room, so nothing stays subscribed to it: a subscription would run it again on each entry and each signal, in
 * every room at once. It subscribes for one answer, lets go, and comes back, and the last answer stays on screen.
 */
function useRoomSeats(
  sittingId: GenericId.GenericId<"examSittings">,
  slug: TenantSlug
) {
  const showing = useDocumentVisibility() === "visible";
  const [reading, setReading] = useState(true);
  const read = useQuery(
    exams.screens.seats,
    reading && showing ? { sittingId, slug } : "skip"
  );
  const seats = useLastValue(read);
  const { start } = useTimeout(() => setReading(true), REFRESH_MILLISECONDS);
  // The answer ends the read during the render, so the subscription goes as soon as the answer comes.
  if (reading && QueryResult.isSuccess(read)) {
    setReading(false);
  }

  useEffect(() => {
    if (!reading) {
      start();
    }
  }, [reading, start]);

  return seats;
}

/**
 * One open room at a glance, on the exam's rooms: one dot for each student who entered, so a principal or a committee
 * sees which room needs a look across all of them (K25, K26), and a sentence for a screen reader. The dots keep one
 * width from the first draw: a table narrower than its columns gives a wrapping box only its widest child, one dot,
 * which stacks a room's students in a column as tall as the room is full, and a box that came with its answer would
 * move every column.
 */
export function RoomSeats({
  sittingId,
  slug,
}: {
  readonly sittingId: GenericId.GenericId<"examSittings">;
  readonly slug: TenantSlug;
}) {
  const t = useTranslations("Exams");
  const seats = useRoomSeats(sittingId, slug);
  const dots = Option.match(seats, { onNone: Arr.empty, onSome: seatDots });

  return (
    <span
      {...Option.match(
        Option.filter(seats, () => Arr.isReadonlyArrayNonEmpty(dots)),
        {
          onNone: () => ({}),
          onSome: (counts) => ({
            "aria-label": t("rooms-seats-summary", counts),
            role: "img",
          }),
        }
      )}
      className="flex w-36 flex-wrap gap-0.5"
    >
      {Arr.map(dots, (dot) => (
        <span className={seatDot({ kind: dot.kind })} key={dot.id} />
      ))}
    </span>
  );
}

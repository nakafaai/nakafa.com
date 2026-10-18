"use client";

import { PersonAvatar } from "@repo/design-system/components/ui/person";
import { cva } from "class-variance-authority";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import type { DashboardAttempt } from "@/components/exams/sitting/change";
import {
  useSittingData,
  useSittingStore,
} from "@/components/exams/sitting/context";
import {
  isDisconnected,
  matchesFilter,
  type SeatFrame,
  seatFrame,
} from "@/components/exams/sitting/seat";

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
 * The seats of the students on the page that the filter keeps. A seat shows its student's
 * animal and name, and its state by colour and line, never by a sentence.
 */
export function SittingSeats() {
  const t = useTranslations("Exams");
  const { value } = useSittingData();
  const filter = useSittingStore((state) => state.filter);
  const seats = Arr.filter(value.attempts.page, (attempt) =>
    matchesFilter(filter, attempt)
  );

  if (Arr.isReadonlyArrayEmpty(value.attempts.page)) {
    return <p className="text-muted-foreground text-sm">{t("seats-empty")}</p>;
  }
  if (Arr.isReadonlyArrayEmpty(seats)) {
    return <p className="text-muted-foreground text-sm">{t("filter-empty")}</p>;
  }

  return (
    <ul
      aria-label={t("seats-label")}
      className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-2"
    >
      {Arr.map(seats, (attempt) => (
        <li key={attempt.id}>
          <SeatButton attempt={attempt} />
        </li>
      ))}
    </ul>
  );
}

/** One student's seat. It opens the student's panel when the proctor selects it. */
function SeatButton({ attempt }: { readonly attempt: DashboardAttempt }) {
  const selected = useSittingStore((state) => state.selected === attempt.id);
  const choose = useSittingStore((state) => state.choose);

  return (
    <button
      aria-pressed={selected}
      className={seatStyles({
        dashed: isDisconnected(attempt),
        frame: seatFrame(attempt),
        selected,
      })}
      onClick={() => choose(attempt.id)}
      type="button"
    >
      <PersonAvatar className="size-6" mascot={attempt.mascot ?? undefined} />
      <span className="min-w-0 truncate">{attempt.name}</span>
    </button>
  );
}

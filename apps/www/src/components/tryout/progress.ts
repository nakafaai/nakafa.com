import {
  CheckmarkCircle02Icon,
  CircleDashedIcon,
  ClockAlertIcon,
  PlayCircle02Icon,
} from "@hugeicons/core-free-icons";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { Match } from "effect";

export type TryoutStatusValue = Docs["tryoutSetProgress"]["status"];

/** A learner's place in one try-out set; a set the learner has not started has none. */
export type TryoutProgress = TryoutStatusValue | null;

/**
 * How one try-out workflow status looks wherever it shows, in a badge or as a filter's value: its icon, the key of its
 * label, and its badge's variant. A set the learner has not started reads as not started.
 */
export const statusLook = (status: TryoutProgress) =>
  Match.value(status).pipe(
    Match.when("in-progress", () => ({
      icon: PlayCircle02Icon,
      label: "status.in-progress" as const,
      variant: "default" as const,
    })),
    Match.when("completed", () => ({
      icon: CheckmarkCircle02Icon,
      label: "status.completed" as const,
      variant: "secondary" as const,
    })),
    Match.when("expired", () => ({
      icon: ClockAlertIcon,
      label: "status.expired" as const,
      variant: "destructive" as const,
    })),
    Match.orElse(() => ({
      icon: CircleDashedIcon,
      label: "status.not-started" as const,
      variant: "muted" as const,
    }))
  );

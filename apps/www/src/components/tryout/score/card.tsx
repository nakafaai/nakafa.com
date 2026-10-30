import type { TryoutScoreResult } from "@repo/backend/confect/tryouts/score";
import type { TryoutStatus as TryoutStatusValue } from "@repo/backend/confect/tryouts/status";
import type { ReactNode } from "react";
import { TryoutScoreStatus } from "@/components/tryout/score/status";
import { TryoutStatus } from "@/components/tryout/status";

/**
 * The top row of a terminal attempt's score card: the score's and the
 * attempt's statuses, then what the caller composed at the end of the row.
 */
export function TryoutScoreHeader({
  children,
  value,
}: {
  children?: ReactNode;
  value: { score: TryoutScoreResult; status: TryoutStatusValue };
}) {
  return (
    <div className="flex min-h-9 items-start justify-between gap-3">
      <div className="flex flex-wrap gap-2">
        <TryoutScoreStatus score={value.score} />
        <TryoutStatus status={value.status} />
      </div>
      {children}
    </div>
  );
}

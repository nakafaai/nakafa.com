import { useMutation } from "@confect/react";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useConvex } from "convex/react";
import { Effect, Option } from "effect";
import { useState } from "react";
import { completeSection } from "@/components/tryout/player/complete";
import type { TryoutPageAddress } from "@/components/tryout/route/path";
import { requireConvexOnline } from "@/lib/convex/online";

/** What a running section needs to finish itself, and where its back leads. */
export interface TryoutFinish {
  /** A finish is on its way to the server or to the page that follows it. */
  readonly pending: boolean;
  /** The page a finish leaves for, which back leads to as well. */
  readonly returnAddress: TryoutPageAddress;
  /** Finishes one section, once; a second call while it runs does nothing. */
  readonly run: (target: {
    attemptId: Id<"tryoutAttempts">;
    sectionKey: string;
  }) => void;
}

/**
 * Finishes the running section with its pending state as plain state, not a transition, so a learner who leaves
 * by another way while the server answers is never held (ADR 0017, Pending Actions Are Not Transitions). The page
 * shows the running state it had at the press until the finish settles, so the finished section never flashes
 * before the page that follows: `shown` is that state. The caller names where a finish leaves for (`leave`), so
 * the finish knows no route.
 */
export function useTryoutFinish<State>(input: {
  leave: Effect.Effect<void>;
  state: State;
}) {
  const [held, hold] = useState(() => Option.none<State>());
  const convex = useConvex();
  const complete = useMutation(tryouts.mutations.sections.complete);
  const pending = Option.isSome(held);

  return {
    pending,
    run: (target: Parameters<TryoutFinish["run"]>[0]) => {
      if (pending) {
        return;
      }
      hold(Option.some(input.state));
      Effect.runFork(
        completeSection(
          requireConvexOnline(convex).pipe(
            Effect.andThen(Effect.tryPromise(() => complete(target))),
            Effect.flatMap(Effect.fromResult)
          ),
          input.leave
        ).pipe(Effect.ensuring(Effect.sync(() => hold(Option.none()))))
      );
    },
    shown: Option.getOrElse(held, () => input.state),
  };
}

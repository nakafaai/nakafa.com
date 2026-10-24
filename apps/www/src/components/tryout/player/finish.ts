import { useMutation } from "@confect/react";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { toast } from "@repo/design-system/lib/toast/notify";
import { useNavigate } from "@tanstack/react-router";
import { useConvex } from "convex/react";
import { Effect, Option } from "effect";
import { useOptimistic, useTransition } from "react";
import {
  getTryoutPageTarget,
  type TryoutPageAddress,
} from "@/components/tryout/route/path";
import { requireConvexOnline } from "@/lib/convex/online";

/** What a running section needs to finish itself. */
export interface TryoutFinish {
  /** A finish is on its way to the server or to the page that follows it. */
  readonly pending: boolean;
  /** The page a finish leads to, which back leads to as well. */
  readonly returnAddress: TryoutPageAddress;
  /** Finishes one section, once; a second call while it runs does nothing. */
  readonly run: (target: {
    attemptId: Id<"tryoutAttempts">;
    sectionKey: string;
  }) => void;
}

/**
 * Finishes the running section in a transition. The state the page shows stays
 * the running one until the page the learner returns to has rendered, so the
 * finished section never flashes between the two: the transition holds the
 * running state, and the router's own transition keeps it held until the
 * navigation commits. `shown` is that state.
 */
export function useTryoutFinish<State>(input: {
  returnAddress: TryoutPageAddress;
  state: State;
}): TryoutFinish & { readonly shown: State } {
  const [shown, hold] = useOptimistic(input.state);
  const [pending, startTransition] = useTransition();
  const navigate = useNavigate();
  /** Leaves for one try-out page. A page that names no route leaves the page on screen. */
  function navigateTo(address: TryoutPageAddress) {
    Option.map(getTryoutPageTarget(address), (target) => navigate(target));
  }
  const convex = useConvex();
  const completeSection = useMutation(tryouts.mutations.sections.complete);

  return {
    pending,
    returnAddress: input.returnAddress,
    run: (target) => {
      if (pending) {
        return;
      }
      startTransition(async () => {
        hold(input.state);
        await Effect.runPromise(
          requireConvexOnline(convex).pipe(
            Effect.andThen(
              Effect.tryPromise(() => completeSection(target)).pipe(
                Effect.flatMap(Effect.fromResult),
                // The page the learner returns to shows the finished section,
                // so no toast repeats it over the page.
                Effect.tap(() =>
                  Effect.sync(() => {
                    startTransition(() => {
                      navigateTo(input.returnAddress);
                    });
                  })
                )
              )
            ),
            Effect.catch(() =>
              Effect.sync(() => {
                toast.error(
                  {
                    description: "tryout-complete-part-error.description",
                    title: "tryout-complete-part-error.title",
                  },
                  { position: "bottom-center" }
                );
              })
            )
          )
        );
      });
    },
    shown,
  };
}

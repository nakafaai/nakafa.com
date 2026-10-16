"use client";

import { useMutation } from "@confect/react";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useConvex } from "convex/react";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { requireConvexOnline } from "@/lib/convex/online";

/** What a running section needs to finish itself. */
export interface TryoutFinish {
  /** A finish is on its way to the server or to the page that follows it. */
  readonly pending: boolean;
  /** Warms the page that follows a finish. */
  readonly prepare: () => void;
  /** The page a finish leads to, which back leads to as well. */
  readonly returnHref: string;
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
  returnHref: string;
  state: State;
}): TryoutFinish & { readonly shown: State } {
  const [shown, hold] = useOptimistic(input.state);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const convex = useConvex();
  const completeSection = useMutation(tryouts.mutations.sections.complete);
  const tTryouts = useTranslations("Tryouts");

  return {
    pending,
    prepare: () => router.prefetch(input.returnHref),
    returnHref: input.returnHref,
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
                Effect.tap(() =>
                  Effect.sync(() => {
                    startTransition(() => {
                      router.push(input.returnHref);
                    });
                    toast.success(tTryouts("complete-part-success"), {
                      position: "bottom-center",
                    });
                  })
                )
              )
            ),
            Effect.catch(() =>
              Effect.sync(() => {
                toast.error(tTryouts("complete-part-error"), {
                  position: "bottom-center",
                });
              })
            )
          )
        );
      });
    },
    shown,
  };
}

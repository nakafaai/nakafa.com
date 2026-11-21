import { useMutation } from "@confect/react";
import { Rocket01Icon } from "@hugeicons/core-free-icons";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { toast } from "@repo/design-system/lib/toast/notify";
import { useNavigate } from "@tanstack/react-router";
import { useConvex } from "convex/react";
import { Effect, Option } from "effect";
import type { TryoutPageAddress } from "@/components/tryout/route/path";
import { getTryoutPageTarget } from "@/components/tryout/route/path";
import {
  useAnswerPress,
  useSetTryoutStartPhase,
  useTryoutStartPhase,
} from "@/components/tryout/runtime/start";
import { START_PART_ERROR } from "@/components/tryout/set/copy";
import { TryoutActionName } from "@/components/tryout/set/name";
import { startEntrySectionProgram } from "@/components/tryout/set/program";
import { requireConvexOnline } from "@/lib/convex/online";

/**
 * Starts one section of a running attempt, so a press lands in the running section and never on a page that asks
 * again. A section with a page of its own opens that page once the server took the start, while the press holds
 * its loader; one that runs where the page shows it, a set's internal entry, draws its player at once (the
 * `opening` phase) and runs there once the server answers, as Convex shows a mutation's result to the page's
 * queries before it answers. A start that fails says so and returns the page.
 */
export function useStartPart() {
  const navigate = useNavigate();
  const convex = useConvex();
  const startSection = useMutation(tryouts.mutations.sections.start);
  const setPhase = useSetTryoutStartPhase();
  return (part: {
    /** The section's page, bound to the attempt; none runs the section where the page shows it. */
    readonly address: Option.Option<TryoutPageAddress>;
    readonly attemptId: Id<"tryoutAttempts">;
    readonly sectionKey: string;
  }) => {
    const target = Option.flatMap(part.address, getTryoutPageTarget);
    const returnPage = Effect.sync(() => setPhase("idle"));
    setPhase(Option.isSome(part.address) ? "starting" : "opening");
    Effect.runPromise(
      requireConvexOnline(convex).pipe(
        Effect.andThen(
          startEntrySectionProgram({
            attemptId: part.attemptId,
            failureMessage: START_PART_ERROR,
            mutation: startSection,
            onFailure: returnPage,
            onSuccess: Option.match(target, {
              onNone: () => returnPage,
              onSome: (page) => Effect.promise(() => navigate(page)),
            }),
            sectionKey: part.sectionKey,
          })
        ),
        Effect.catchTag("ConvexOfflineError", () =>
          Effect.sync(() => {
            toast.error(START_PART_ERROR, { position: "bottom-center" });
          }).pipe(Effect.andThen(returnPage))
        )
      )
    );
  };
}

/** Continues a running attempt whose next section has not started: one press starts it and opens its page. */
export function ContinueTryoutButton({
  address,
  attemptId,
  sectionKey,
}: {
  /** The next section's page, bound to the attempt. */
  readonly address: TryoutPageAddress;
  readonly attemptId: Id<"tryoutAttempts">;
  readonly sectionKey: string;
}) {
  const startPart = useStartPart();
  const busy = useTryoutStartPhase() !== "idle";
  /** Opens the next section, once. */
  function onContinue() {
    if (!busy) {
      startPart({ address: Option.some(address), attemptId, sectionKey });
    }
  }
  useAnswerPress(onContinue);
  return (
    <Button inert={busy} onClick={onContinue} type="button">
      <Spinner icon={Rocket01Icon} isLoading={busy} />
      <TryoutActionName name="continue-cta" />
    </Button>
  );
}

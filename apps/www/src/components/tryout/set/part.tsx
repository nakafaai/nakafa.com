import { useMutation } from "@confect/react";
import { Rocket01Icon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Button } from "@repo/design-system/components/ui/button";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { toast } from "@repo/design-system/lib/toast/notify";
import { useNavigate } from "@tanstack/react-router";
import { useConvex } from "convex/react";
import { Effect, Option } from "effect";
import { useFormatter, useTranslations } from "use-intl";
import { PaneFact, PaneFacts } from "@/components/shared/page/pane";
import type { TryoutPageAddress } from "@/components/tryout/route/path";
import { getTryoutPageTarget } from "@/components/tryout/route/path";
import {
  useAnswerPress,
  useSetTryoutStartPhase,
  useTryoutStartPhase,
} from "@/components/tryout/runtime/start";
import { START_PART_ERROR } from "@/components/tryout/set/copy";
import type { TryoutPart } from "@/components/tryout/set/model";
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

/**
 * Confirms starting one timed part of a running attempt before its clock starts: shows the part's question count
 * and duration, and starts the section only after an explicit press on Start.
 */
export function TryoutPartStartDialog({
  busy,
  onStart,
  open,
  part,
  setOpen,
}: {
  readonly busy: boolean;
  readonly onStart: () => void;
  readonly open: boolean;
  readonly part: TryoutPart;
  readonly setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("Tryouts");
  const tCommon = useTranslations("Common");
  const format = useFormatter();

  return (
    <ResponsiveDialog
      action={
        <Button
          inert={busy}
          onClick={() => {
            setOpen(false);
            onStart();
          }}
          type="button"
        >
          <Spinner icon={Rocket01Icon} isLoading={busy} />
          {t("action.start-cta")}
        </Button>
      }
      description={t("start-part-description")}
      open={open}
      setOpen={setOpen}
      title={part.title}
    >
      <PaneFacts layout="grid">
        <PaneFact label={tCommon("exam-questions")}>
          {format.number(part.questionCount)}
        </PaneFact>
        <PaneFact label={t("set-column-duration")}>
          {t("set-duration-minutes", {
            minutes: part.timeLimitSeconds / 60,
          })}
        </PaneFact>
      </PaneFacts>
    </ResponsiveDialog>
  );
}

/** Continues a running attempt whose next part has not started: asks for confirmation before starting its clock. */
export function ContinueTryoutButton({
  address,
  attemptId,
  part,
}: {
  /** The next part's page, bound to the attempt. */
  readonly address: TryoutPageAddress;
  readonly attemptId: Id<"tryoutAttempts">;
  readonly part: TryoutPart;
}) {
  const startPart = useStartPart();
  const busy = useTryoutStartPhase() !== "idle";
  const [dialogOpen, dialog] = useDisclosure(false);

  /** Starts the next part once the learner confirms. */
  function onConfirm() {
    if (!busy) {
      startPart({
        address: Option.some(address),
        attemptId,
        sectionKey: part.sectionKey,
      });
    }
  }
  useAnswerPress(dialog.open);

  return (
    <>
      <Button inert={busy} onClick={dialog.open} type="button">
        <Spinner icon={Rocket01Icon} isLoading={busy} />
        <TryoutActionName name="continue-cta" />
      </Button>
      <TryoutPartStartDialog
        busy={busy}
        onStart={onConfirm}
        open={dialogOpen}
        part={part}
        setOpen={(open) => (open ? dialog.open() : dialog.close())}
      />
    </>
  );
}

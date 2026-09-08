"use client";

import { StopIcon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
import { NumberFormat } from "@repo/design-system/components/ui/number-flow";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useMutation } from "convex/react";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { BreadcrumbHeaderFrame } from "@/components/shared/breadcrumb/frame";
import { useTryoutDataIntent } from "@/components/tryout/navigation/data.client";
import { useTryoutClock } from "@/components/tryout/runtime/clock";
import { TryoutTimer } from "@/components/tryout/runtime/countdown";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";

interface TryoutRuntimeControlsValue {
  expired: boolean;
  returnHref: string;
  runtime: TryoutSectionRuntime;
}

/** Renders the production sticky timer, progress, and finish controls. */
export function TryoutRuntimeControls({
  title,
  value,
}: {
  title: string;
  value: TryoutRuntimeControlsValue;
}) {
  const { expired, returnHref, runtime } = value;
  const router = useRouter();
  const prewarmData = useTryoutDataIntent();
  const completeSection = useMutation(api.tryouts.mutations.sections.complete);
  const tTryouts = useTranslations("Tryouts");
  const [isPending, startTransition] = useTransition();
  const [isOpen, { close: closeDialog, open: openDialog }] =
    useDisclosure(false);
  const now = useTryoutClock(true);
  const remainingSeconds = Math.max(
    0,
    Math.ceil((runtime.expiresAt - now) / 1000)
  );
  const isBusy = isPending || expired;

  /** Prefetch the set route and warm its authenticated data before return. */
  function prepareReturnRoute() {
    router.prefetch(returnHref);
    prewarmData({
      attemptId: runtime.attemptId,
      kind: "set",
    });
  }

  /** Prepare the return route before opening completion confirmation. */
  function openCompletionDialog() {
    prepareReturnRoute();
    openDialog();
  }

  /** Completes the current section through Convex and returns to the set page. */
  function onComplete() {
    if (isBusy) {
      return;
    }

    startTransition(async () => {
      await Effect.runPromise(
        Effect.tryPromise(() =>
          completeSection({
            attemptId: runtime.attemptId,
            sectionKey: runtime.section.sectionKey,
          })
        ).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              closeDialog();
              router.push(returnHref);
              toast.success(tTryouts("complete-part-success"), {
                position: "bottom-center",
              });
            })
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
  }

  return (
    <>
      <BreadcrumbHeaderFrame contentClassName="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <h1 className="min-w-0 truncate font-medium text-sm" title={title}>
          {title}
        </h1>
        <div className="col-span-2 row-start-2 flex items-center justify-center gap-4 sm:col-span-1 sm:col-start-2 sm:row-start-1">
          <TryoutTimer seconds={remainingSeconds} />
          <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border" />
          <output
            aria-label={`${tTryouts("part-questions-label")}: ${runtime.section.answeredCount}/${runtime.section.totalQuestions}`}
            className="inline-flex font-mono text-sm tabular-nums"
            style={{
              minWidth: `${String(runtime.section.totalQuestions).length * 2 + 3}ch`,
            }}
          >
            <NumberFormat
              aria-hidden="true"
              format={{ useGrouping: false }}
              suffix={` / ${runtime.section.totalQuestions}`}
              value={runtime.section.answeredCount}
            />
          </output>
        </div>
        <div className="col-start-2 row-start-1 flex justify-end sm:col-start-3">
          <Button
            disabled={isBusy}
            onClick={openCompletionDialog}
            onFocus={prepareReturnRoute}
            onPointerEnter={prepareReturnRoute}
            onTouchStart={prepareReturnRoute}
            type="button"
            variant="destructive"
          >
            <Spinner icon={StopIcon} isLoading={isPending} />
            {tTryouts("complete-part-cta")}
          </Button>
        </div>
      </BreadcrumbHeaderFrame>

      <ResponsiveDialog
        description={tTryouts("complete-part-description")}
        footer={
          <>
            <Button onClick={closeDialog} type="button" variant="outline">
              {tTryouts("cancel-cta")}
            </Button>
            <Button
              disabled={isBusy}
              onClick={onComplete}
              type="button"
              variant="destructive"
            >
              <Spinner icon={StopIcon} isLoading={isPending} />
              {tTryouts("complete-part-cta")}
            </Button>
          </>
        }
        open={isOpen}
        setOpen={(nextOpen) => {
          if (nextOpen) {
            openCompletionDialog();
            return;
          }

          closeDialog();
        }}
        title={tTryouts("complete-part-title")}
      />
    </>
  );
}

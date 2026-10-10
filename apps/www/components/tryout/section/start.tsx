"use client";

import { useMutation } from "@confect/react";
import { Rocket01Icon } from "@hugeicons/core-free-icons";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useConvex } from "convex/react";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { requireConvexOnline } from "@/lib/convex/online";

interface StartSectionButtonProps {
  attemptId: Id<"tryoutAttempts">;
  sectionKey: string;
}

/** Starts the selected section inside an already-active try-out attempt. */
export function StartSectionButton({
  attemptId,
  sectionKey,
}: StartSectionButtonProps) {
  const startSection = useMutation(tryouts.mutations.sections.start);
  const convex = useConvex();
  const tTryouts = useTranslations("Tryouts");
  const [isPending, startTransition] = useTransition();

  /** Starts this section timer and lets the Convex runtime subscription update. */
  function onStart() {
    if (isPending) {
      return;
    }

    startTransition(async () => {
      await Effect.runPromise(
        requireConvexOnline(convex).pipe(
          Effect.andThen(
            Effect.tryPromise(() =>
              startSection({
                attemptId,
                sectionKey,
              })
            ).pipe(
              Effect.flatMap(Effect.fromResult),
              Effect.tap(() =>
                Effect.sync(() => {
                  toast.success(tTryouts("start-part-success"), {
                    position: "bottom-center",
                  });
                })
              )
            )
          ),
          Effect.catch(() =>
            Effect.sync(() => {
              toast.error(tTryouts("start-part-error"), {
                position: "bottom-center",
              });
            })
          )
        )
      );
    });
  }

  return (
    <Button disabled={isPending} onClick={onStart} type="button">
      <Spinner className="size-4" icon={Rocket01Icon} isLoading={isPending} />
      {tTryouts("start-part-cta")}
    </Button>
  );
}

"use client";

import { Rocket01Icon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useMutation } from "convex/react";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

interface StartSectionButtonProps {
  attemptId: Id<"tryoutAttempts">;
  sectionHref: string;
  sectionKey: string;
}

/** Starts the selected section inside an already-active try-out attempt. */
export function StartSectionButton({
  attemptId,
  sectionHref,
  sectionKey,
}: StartSectionButtonProps) {
  const router = useRouter();
  const startSection = useMutation(api.tryouts.mutations.sections.start);
  const tTryouts = useTranslations("Tryouts");
  const [isPending, startTransition] = useTransition();

  /** Starts this section timer and lets the Convex runtime subscription update. */
  function onStart() {
    if (isPending) {
      return;
    }

    startTransition(async () => {
      await Effect.runPromise(
        Effect.tryPromise({
          try: () =>
            startSection({
              attemptId,
              sectionKey,
            }),
          catch: (cause) => cause,
        }).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              router.replace(sectionHref);
              toast.success(tTryouts("start-part-success"), {
                position: "bottom-center",
              });
            })
          ),
          Effect.catchAll(() =>
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

"use client";

import type { Ref } from "@confect/core";
import { type InvokeReturn, useMutation } from "@confect/react";
import { Rocket01Icon } from "@hugeicons/core-free-icons";
import refs from "@repo/backend/confect/_generated/refs";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { type TransitionStartFunction, useTransition } from "react";
import { toast } from "sonner";

type StartSection = typeof refs.public.tryouts.mutations.sections.start;

interface StartSectionButtonProps {
  attemptId: Id<"tryoutAttempts">;
  sectionKey: string;
}

/** Starts the selected section inside an already-active try-out attempt. */
export function StartSectionButton({
  attemptId,
  sectionKey,
}: StartSectionButtonProps) {
  const startSection = useMutation(
    refs.public.tryouts.mutations.sections.start
  );
  const tPlayer = useTranslations("Player");
  const tTryouts = useTranslations("Tryouts");
  const [isPending, startTransition] = useTransition();

  /** Starts this section; the runtime appearing is the feedback. */
  function onStart() {
    if (isPending) {
      return;
    }
    startSectionTimer({
      args: { attemptId, sectionKey },
      copy: {
        message: tTryouts("start-part-error"),
        retry: tPlayer("retry"),
      },
      startSection,
      startTransition,
    });
  }
  return (
    <Button onClick={onStart} type="button">
      <HugeIcons className="size-4" icon={Rocket01Icon} />
      {tTryouts("start-part-cta")}
    </Button>
  );
}

/** Starts the section timer in a transition; a failure offers it again. */
function startSectionTimer(input: {
  readonly args: Ref.Args<StartSection>;
  readonly copy: { readonly message: string; readonly retry: string };
  readonly startSection: (
    args: Ref.Args<StartSection>
  ) => InvokeReturn<StartSection>;
  readonly startTransition: TransitionStartFunction;
}) {
  input.startTransition(async () => {
    await Effect.runPromise(
      Effect.tryPromise(() => input.startSection(input.args)).pipe(
        Effect.flatMap(Effect.fromResult),
        Effect.catch(() =>
          Effect.sync(() => {
            toast.error(input.copy.message, {
              action: {
                label: input.copy.retry,
                onClick: () => startSectionTimer(input),
              },
              id: "tryout-start-section",
              position: "bottom-center",
            });
          })
        )
      )
    );
  });
}

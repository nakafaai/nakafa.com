import { useMutation } from "@confect/react";
import { Rocket01Icon } from "@hugeicons/core-free-icons";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { toast } from "@repo/design-system/lib/toast/notify";
import { useConvex } from "convex/react";
import { Effect } from "effect";
import { useTransition } from "react";
import { useTranslations } from "use-intl";
import { ConvexIsland } from "@/components/providers/island";
import { START_PART_ERROR } from "@/components/tryout/set/copy";
import { requireConvexOnline } from "@/lib/convex/online";

interface StartSectionButtonProps {
  attemptId: Id<"tryoutAttempts">;
  sectionKey: string;
}

/**
 * Starts the selected section inside an already-active try-out attempt. The button
 * is inert until the page holds its client, so the first HTML shows the same control.
 */
export function StartSectionButton(props: StartSectionButtonProps) {
  return (
    <ConvexIsland fallback={<StartSectionControl inert />}>
      <StartSectionLive {...props} />
    </ConvexIsland>
  );
}

/** Starts this section timer through the page's client, and the Convex runtime subscription shows it. */
function StartSectionLive({ attemptId, sectionKey }: StartSectionButtonProps) {
  const startSection = useMutation(tryouts.mutations.sections.start);
  const convex = useConvex();
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
            ).pipe(Effect.flatMap(Effect.fromResult))
          ),
          Effect.catch(() =>
            Effect.sync(() => {
              toast.error(START_PART_ERROR, { position: "bottom-center" });
            })
          )
        )
      );
    });
  }

  return <StartSectionControl inert={isPending} onStart={onStart} />;
}

/** The section start control. Without `onStart` it is only the page's first frame. */
function StartSectionControl({
  inert,
  onStart,
}: {
  inert: boolean;
  onStart?: () => void;
}) {
  const tTryouts = useTranslations("Tryouts");
  return (
    <Button inert={inert} onClick={onStart} type="button">
      <HugeIcons className="size-4" icon={Rocket01Icon} />
      {tTryouts("start-part-cta")}
    </Button>
  );
}

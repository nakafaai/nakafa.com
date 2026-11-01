import { useMutation } from "@confect/react";
import { Rocket01Icon } from "@hugeicons/core-free-icons";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { toast } from "@repo/design-system/lib/toast/notify";
import { useConvex } from "convex/react";
import { Effect } from "effect";
import { ConvexIsland } from "@/components/providers/island";
import {
  useSetTryoutStartPhase,
  useTryoutStartPhase,
} from "@/components/tryout/runtime/start";
import { START_PART_ERROR } from "@/components/tryout/set/copy";
import { TryoutActionName } from "@/components/tryout/set/name";
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

/**
 * Starts this section timer through the page's client. The page draws the player with the press, and
 * the Convex runtime subscription runs it once the server answers; a start that fails returns the page.
 */
function StartSectionLive({ attemptId, sectionKey }: StartSectionButtonProps) {
  const startSection = useMutation(tryouts.mutations.sections.start);
  const convex = useConvex();
  const phase = useTryoutStartPhase();
  const setPhase = useSetTryoutStartPhase();

  /** Opens the player at once, then starts this section timer on the server. */
  function onStart() {
    if (phase !== "idle") {
      return;
    }
    setPhase("opening");
    Effect.runPromise(
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
        ),
        // Convex shows a mutation's result to the page's queries before it answers, so the section runs
        // on the page by now, or it failed and the page returns.
        Effect.ensuring(Effect.sync(() => setPhase("idle")))
      )
    );
  }

  return <StartSectionControl inert={phase !== "idle"} onStart={onStart} />;
}

/** The section start control. Without `onStart` it is only the page's first frame. */
function StartSectionControl({
  inert,
  onStart,
}: {
  inert: boolean;
  onStart?: () => void;
}) {
  return (
    <Button inert={inert} onClick={onStart} type="button">
      <Spinner className="size-4" icon={Rocket01Icon} isLoading={inert} />
      <TryoutActionName name="start-cta" />
    </Button>
  );
}

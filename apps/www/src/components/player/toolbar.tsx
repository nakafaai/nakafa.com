import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect, Option } from "effect";
import { useTransition } from "react";
import { useTranslations } from "use-intl";
import { decodePlayerMode } from "@/components/player/mode";
import { usePlayer } from "@/components/player/provider";
import { rememberPlayerMode } from "@/components/player/remember";

/**
 * The toolbar row under the player's header, at one fixed height: the view, the
 * list or one question at a time, where a learner sees both and switches at
 * once. It sticks under the header, so the questions never slide under it. A
 * player with no questions, such as a sitting whose paper failed to load, shows
 * no toolbar.
 */
export function PlayerToolbar() {
  const shown = usePlayer((state) => state.keys.length > 0);

  if (!shown) {
    return null;
  }

  return (
    <div
      className="sticky top-[calc(var(--app-header-top,4rem)+4rem)] z-10 border-b bg-background lg:top-16"
      data-player-toolbar=""
    >
      <div className="mx-auto flex h-12 w-full max-w-7xl items-center px-4 sm:px-6">
        <PlayerModeToggle />
      </div>
    </div>
  );
}

/**
 * Switches between the list and one question at a time. The view changes at
 * once, and the choice is saved in a transition. When it cannot be saved the
 * last saved view comes back, unless the learner chose again since.
 */
function PlayerModeToggle() {
  const t = useTranslations("Player");
  const mode = usePlayer((state) => state.mode);
  const choose = usePlayer((state) => state.choose);
  const [, startTransition] = useTransition();

  /** Applies a pressed item; pressing the shown item again changes nothing. */
  function onValueChange(value: string) {
    const next = decodePlayerMode(value);
    if (Option.isNone(next)) {
      return;
    }
    startTransition(async () => {
      const choice = await Effect.runPromise(
        choose(next.value, rememberPlayerMode(next.value))
      );
      if (choice === "reverted") {
        toast.error(
          {
            description: "mode-error.description",
            title: "mode-error.title",
          },
          { position: "bottom-center" }
        );
      }
    });
  }

  return (
    <ToggleGroup
      aria-label={t("mode")}
      onValueChange={onValueChange}
      value={mode}
      variant="outline"
    >
      <ToggleGroupItem value="list">{t("mode-list")}</ToggleGroupItem>
      <ToggleGroupItem value="single">{t("mode-single")}</ToggleGroupItem>
    </ToggleGroup>
  );
}

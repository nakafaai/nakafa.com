"use client";

import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect, Option } from "effect";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { decodePlayerMode } from "@/components/player/mode";
import { usePlayer } from "@/components/player/provider";
import { rememberPlayerMode } from "@/components/player/remember.client";

/**
 * Switches between the list and one question at a time. The view changes at
 * once, and the choice is saved in a transition. When it cannot be saved the
 * last saved view comes back, unless the learner chose again since.
 */
export function PlayerModeToggle() {
  const t = useTranslations("Player");
  const tToast = useTranslations("Toast");
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
        toast.error(tToast("mode-error.title"), {
          description: tToast("mode-error.description"),
          position: "bottom-center",
        });
      }
    });
  }

  return (
    <ToggleGroup
      aria-label={t("mode")}
      gridColumns="2"
      onValueChange={onValueChange}
      value={mode}
      variant="outline"
    >
      <ToggleGroupItem value="list">{t("mode-list")}</ToggleGroupItem>
      <ToggleGroupItem value="single">{t("mode-single")}</ToggleGroupItem>
    </ToggleGroup>
  );
}

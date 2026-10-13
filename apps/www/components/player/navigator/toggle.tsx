"use client";

import {
  LeftToRightListDashIcon,
  SquareIcon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { Effect, Option } from "effect";
import { useTranslations } from "next-intl";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { decodePlayerMode } from "@/components/player/mode";
import { usePlayer } from "@/components/player/provider";
import { rememberPlayerMode } from "@/components/player/remember.client";

/**
 * Switches between the list and one question at a time. The view changes at
 * once, and the choice is saved in a transition. When it cannot be saved the
 * previous view comes back, unless the learner chose again since.
 */
export function PlayerModeToggle() {
  const t = useTranslations("Player");
  const mode = usePlayer((state) => state.mode);
  const setMode = usePlayer((state) => state.setMode);
  const [, startTransition] = useTransition();
  const requests = useRef(0);

  /** Applies a pressed item; pressing the shown item again changes nothing. */
  function onValueChange(value: string) {
    const next = decodePlayerMode(value);
    if (Option.isNone(next)) {
      return;
    }
    const request = requests.current + 1;
    requests.current = request;
    setMode(next.value);
    startTransition(async () => {
      const saved = await Effect.runPromise(rememberPlayerMode(next.value));
      if (saved || request !== requests.current) {
        return;
      }
      setMode(mode);
      toast.error(t("mode-error"), { position: "bottom-center" });
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
      <ToggleGroupItem value="list">
        <HugeIcons icon={LeftToRightListDashIcon} />
        {t("mode-list")}
      </ToggleGroupItem>
      <ToggleGroupItem value="single">
        <HugeIcons icon={SquareIcon} />
        {t("mode-single")}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

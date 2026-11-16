import { Kbd, KbdGroup } from "@repo/design-system/components/ui/kbd";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { usePlayer } from "@/components/player/provider";

/**
 * Lists the keys that drive the player, one fact per line. A finished paper takes no pick and no flag, so
 * it lists only the keys that move through it.
 */
export function PlayerShortcuts() {
  const t = useTranslations("Player");
  const review = usePlayer((state) => state.review);

  return (
    <dl className="text-muted-foreground mt-auto grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-xs">
      <PlayerShortcut keys={["←", "→"]}>{t("shortcut-step")}</PlayerShortcut>
      {review ? null : (
        <>
          <PlayerShortcut keys={["1-5"]}>{t("shortcut-pick")}</PlayerShortcut>
          <PlayerShortcut keys={["F"]}>{t("shortcut-flag")}</PlayerShortcut>
        </>
      )}
      <PlayerShortcut keys={["G"]}>{t("shortcut-navigator")}</PlayerShortcut>
    </dl>
  );
}

/** One key, or one group of keys, with what it does. */
function PlayerShortcut({
  children,
  keys,
}: {
  children: ReactNode;
  keys: readonly string[];
}) {
  return (
    <>
      <dt>
        <KbdGroup>
          {Arr.map(keys, (key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
        </KbdGroup>
      </dt>
      <dd>{children}</dd>
    </>
  );
}

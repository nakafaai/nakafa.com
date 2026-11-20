"use client";

import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { IslandChart } from "@/components/island/chart";
import type { Sheet } from "@/components/island/store";
import { useGame } from "@/components/island/store";

/**
 * One of the sheets the HUD opens over the world (ADR 0050, W7), one at a
 * time: a dialog on a wide screen and a drawer on a phone, open while the
 * game's store names it, with its title, its one sentence and its body. Its
 * close, a swipe or a press outside lets go of it.
 */
export function HudSheet({
  children,
  description,
  sheet,
  title,
}: {
  children: ReactNode;
  description: string;
  sheet: Sheet;
  title: string;
}) {
  const open = useGame((state) => state.sheet === sheet);
  const setSheet = useGame((state) => state.setSheet);
  return (
    <ResponsiveDialog
      description={description}
      open={open}
      setOpen={(next) => {
        if (!next) {
          setSheet(null);
        }
      }}
      title={title}
    >
      {children}
    </ResponsiveDialog>
  );
}

/** The map of the land about the fox, north up, with the fox and the way home marked. */
export function MapSheet() {
  const t = useTranslations("Island");
  return (
    <HudSheet description={t("map-description")} sheet="map" title={t("map")}>
      <IslandChart foxLabel={t("map-fox")} homeLabel={t("map-home")} />
    </HudSheet>
  );
}

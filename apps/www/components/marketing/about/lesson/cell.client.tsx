"use client";

import { BacteriaStructureLab } from "@repo/design-system/components/contents/biology/bacteria";
import { useTranslations } from "next-intl";

/** The cell lesson's lab: the shape, the inside and the wall of a bacterium. */
export function CellLesson() {
  const t = useTranslations("Landing");

  return (
    <BacteriaStructureLab
      labels={{
        chooseMode: t("lab.bacteria.choose"),
        items: [
          {
            scene: { kind: "shape" },
            tab: t("lab.bacteria.shape.tab"),
          },
          {
            scene: { kind: "structure" },
            tab: t("lab.bacteria.inside.tab"),
          },
          {
            scene: { kind: "wall" },
            tab: t("lab.bacteria.wall.tab"),
          },
        ],
        viewLabel: t("lab.bacteria.view"),
      }}
    />
  );
}

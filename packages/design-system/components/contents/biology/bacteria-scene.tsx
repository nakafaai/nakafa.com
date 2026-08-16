"use client";

import { BacterialShapes } from "@repo/design-system/components/contents/biology/bacteria-shapes";
import { BacterialStructure } from "@repo/design-system/components/contents/biology/bacteria-structure";
import { GramWallComparison } from "@repo/design-system/components/contents/biology/bacteria-wall";
import type {
  BiologyLabItem,
  BiologySceneProps,
} from "@repo/design-system/components/contents/biology/data";
import type { ReactNode } from "react";

type BacteriaScene =
  | {
      bacillusLabel: ReactNode;
      coccusLabel: ReactNode;
      kind: "shape";
      spiralLabel: ReactNode;
    }
  | {
      kind: "structure";
      nucleoidDnaLabel: ReactNode;
    }
  | {
      gramNegativeLabel: ReactNode;
      gramPositiveLabel: ReactNode;
      kind: "wall";
    };

export interface BacteriaLabItem extends BiologyLabItem {
  scene: BacteriaScene;
}

/** Uses distinct scenes for morphology, inner anatomy, and Gram wall logic. */
export function BacteriaStructureScene({
  colors,
  item,
}: BiologySceneProps<BacteriaLabItem>) {
  if (item.scene.kind === "structure") {
    return (
      <BacterialStructure
        colors={colors}
        nucleoidDnaLabel={item.scene.nucleoidDnaLabel}
      />
    );
  }

  if (item.scene.kind === "wall") {
    return (
      <GramWallComparison
        colors={colors}
        gramNegativeLabel={item.scene.gramNegativeLabel}
        gramPositiveLabel={item.scene.gramPositiveLabel}
      />
    );
  }

  return (
    <BacterialShapes
      bacillusLabel={item.scene.bacillusLabel}
      coccusLabel={item.scene.coccusLabel}
      colors={colors}
      spiralLabel={item.scene.spiralLabel}
    />
  );
}

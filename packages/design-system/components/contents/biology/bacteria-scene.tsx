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

const LEGACY_SHAPE_SCENE = {
  bacillusLabel: "Basilus",
  coccusLabel: "Kokus",
  kind: "shape",
  spiralLabel: "Spiral",
} satisfies BacteriaScene;

const LEGACY_STRUCTURE_SCENE = {
  kind: "structure",
  nucleoidDnaLabel: "Nukleoid DNA",
} satisfies BacteriaScene;

const LEGACY_WALL_SCENE = {
  gramNegativeLabel: "Gram negatif",
  gramPositiveLabel: "Gram positif",
  kind: "wall",
} satisfies BacteriaScene;

/**
 * Keeps already signed content renderable while new authoring supplies the
 * required locale-owned scene labels.
 */
function resolveBacteriaScene(
  item: BacteriaLabItem,
  selectedIndex: number
): BacteriaScene {
  if ("scene" in item) {
    return item.scene;
  }

  if (selectedIndex === 1) {
    return LEGACY_STRUCTURE_SCENE;
  }

  if (selectedIndex === 2) {
    return LEGACY_WALL_SCENE;
  }

  return LEGACY_SHAPE_SCENE;
}

/** Uses distinct scenes for morphology, inner anatomy, and Gram wall logic. */
export function BacteriaStructureScene({
  colors,
  item,
  selectedIndex,
}: BiologySceneProps<BacteriaLabItem>) {
  const scene = resolveBacteriaScene(item, selectedIndex);

  if (scene.kind === "structure") {
    return (
      <BacterialStructure
        colors={colors}
        nucleoidDnaLabel={scene.nucleoidDnaLabel}
      />
    );
  }

  if (scene.kind === "wall") {
    return (
      <GramWallComparison
        colors={colors}
        gramNegativeLabel={scene.gramNegativeLabel}
        gramPositiveLabel={scene.gramPositiveLabel}
      />
    );
  }

  return (
    <BacterialShapes
      bacillusLabel={scene.bacillusLabel}
      coccusLabel={scene.coccusLabel}
      colors={colors}
      spiralLabel={scene.spiralLabel}
    />
  );
}

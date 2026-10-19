"use client";

import type {
  ChemicalReactionTypeId,
  ChemicalReactionTypeSceneColors,
} from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/data";
import { createContext, type ReactNode, use } from "react";

interface ChemicalReactionTypeSceneValues {
  colors: ChemicalReactionTypeSceneColors;
  typeId: ChemicalReactionTypeId;
}

const ChemicalReactionTypeSceneContext =
  createContext<ChemicalReactionTypeSceneValues | null>(null);

/** Provides the colors and the selected reaction type of one lab to its scene. */
export function ChemicalReactionTypeSceneProvider({
  children,
  colors,
  typeId,
}: ChemicalReactionTypeSceneValues & { children: ReactNode }) {
  return (
    <ChemicalReactionTypeSceneContext value={{ colors, typeId }}>
      {children}
    </ChemicalReactionTypeSceneContext>
  );
}

/** Reads the colors and the selected reaction type of the surrounding lab. */
export function useChemicalReactionTypeScene() {
  const scene = use(ChemicalReactionTypeSceneContext);
  if (!scene) {
    // A missing provider is a programmer composition error at this React seam.
    throw new Error(
      "useChemicalReactionTypeScene must be used within ChemicalReactionTypeSceneProvider"
    );
  }
  return scene;
}

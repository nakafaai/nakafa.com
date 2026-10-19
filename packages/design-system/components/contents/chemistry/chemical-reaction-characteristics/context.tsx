"use client";

import type {
  ReactionCueId,
  ReactionSceneColors,
} from "@repo/design-system/components/contents/chemistry/chemical-reaction-characteristics/data";
import { createContext, type ReactNode, use } from "react";

interface ReactionCharacteristicsSceneProviderProps {
  children: ReactNode;
  colors: ReactionSceneColors;
  cueId: ReactionCueId;
}

const ReactionCharacteristicsSceneContext = createContext<Omit<
  ReactionCharacteristicsSceneProviderProps,
  "children"
> | null>(null);

/** Provides the colors and the selected cue of one lab to its scene. */
export function ReactionCharacteristicsSceneProvider({
  children,
  colors,
  cueId,
}: ReactionCharacteristicsSceneProviderProps) {
  return (
    <ReactionCharacteristicsSceneContext value={{ colors, cueId }}>
      {children}
    </ReactionCharacteristicsSceneContext>
  );
}

/** Reads the colors and the selected cue of the surrounding lab. */
export function useReactionCharacteristicsScene() {
  const scene = use(ReactionCharacteristicsSceneContext);
  if (!scene) {
    // A missing provider is a programmer composition error at this React seam.
    throw new Error(
      "useReactionCharacteristicsScene must be used within ReactionCharacteristicsSceneProvider"
    );
  }
  return scene;
}

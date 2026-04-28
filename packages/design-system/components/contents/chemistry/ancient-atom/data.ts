import type { ReactNode } from "react";

export const WHOLE_MATTER_LEVEL_ID = "whole";
export const FIRST_CUT_LEVEL_ID = "first-cut";
export const SECOND_CUT_LEVEL_ID = "second-cut";
export const FINE_CUT_LEVEL_ID = "fine-cut";

export const ANCIENT_ATOM_LEVELS = [
  {
    id: WHOLE_MATTER_LEVEL_ID,
    pieces: 1,
  },
  {
    id: FIRST_CUT_LEVEL_ID,
    pieces: 2,
  },
  {
    id: SECOND_CUT_LEVEL_ID,
    pieces: 4,
  },
  {
    id: FINE_CUT_LEVEL_ID,
    pieces: 8,
  },
] as const;

export type AncientAtomLevelId = (typeof ANCIENT_ATOM_LEVELS)[number]["id"];

export interface AncientAtomLevelLabels {
  tab: string;
}

export interface AncientAtomLabLabels {
  aristotleBody: ReactNode;
  aristotleLabel: string;
  chooseLevel: string;
  democritusBody: ReactNode;
  democritusLabel: string;
  levels: Record<AncientAtomLevelId, AncientAtomLevelLabels>;
}

export interface AncientAtomLabProps {
  description: ReactNode;
  labels: AncientAtomLabLabels;
  title: ReactNode;
}

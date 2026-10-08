import { Schema } from "effect";
import type { ReactNode } from "react";

export const WHOLE_MATTER_LEVEL_ID = "whole";
export const FIRST_CUT_LEVEL_ID = "first-cut";
export const SECOND_CUT_LEVEL_ID = "second-cut";
export const FINE_CUT_LEVEL_ID = "fine-cut";

const AncientAtomLevelIdSchema = Schema.Literals([
  WHOLE_MATTER_LEVEL_ID,
  FIRST_CUT_LEVEL_ID,
  SECOND_CUT_LEVEL_ID,
  FINE_CUT_LEVEL_ID,
]);

export type AncientAtomLevelId = typeof AncientAtomLevelIdSchema.Type;

const AncientAtomLevelSchema = Schema.Struct({
  id: AncientAtomLevelIdSchema,
  pieces: Schema.Finite,
});

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
] satisfies (typeof AncientAtomLevelSchema.Type)[];

const AncientAtomLevelLabelsSchema = Schema.Struct({
  tab: Schema.String,
});

export type AncientAtomLevelLabels = typeof AncientAtomLevelLabelsSchema.Type;

export interface AncientAtomLabLabels {
  aristotleBody: ReactNode;
  aristotleLabel: string;
  chooseLevel: string;
  democritusBody: ReactNode;
  democritusLabel: string;
  levels: Record<AncientAtomLevelId, AncientAtomLevelLabels>;
}

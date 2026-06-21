import { Schema } from "effect";

export const MATERIAL_CARD_DESCRIPTION_MAX_LENGTH = 56;

export const MaterialCardDescriptionSchema = Schema.Trim.pipe(
  Schema.minLength(1),
  Schema.maxLength(MATERIAL_CARD_DESCRIPTION_MAX_LENGTH)
);

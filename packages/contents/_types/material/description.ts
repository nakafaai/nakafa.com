import { Schema } from "effect";

const MATERIAL_CARD_DESCRIPTION_MAX_LENGTH = 56;
export const MaterialCardDescriptionSchema = Schema.Trim.pipe(
  Schema.check(Schema.isMinLength(1)),
  Schema.check(Schema.isMaxLength(MATERIAL_CARD_DESCRIPTION_MAX_LENGTH))
);

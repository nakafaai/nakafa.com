/** Schema for a signed text: one or more characters, with no blank edge. */
export const SIGNED_TEXT = {
  type: "string",
  pattern: "^\\S[\\s\\S]*\\S$|^\\S$|^$",
  minLength: 1,
};

/** Schema for a signed retrieval time in UTC, to the whole second. */
export const RETRIEVED_AT = {
  type: "string",
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$",
};

/** Schema for a whole number above zero. */
export const POSITIVE_INTEGER = {
  type: "integer",
  exclusiveMinimum: 0,
  maximum: Number.MAX_SAFE_INTEGER,
};

/** Schema for a whole number from zero up. */
export const NON_NEGATIVE_INTEGER = {
  type: "integer",
  minimum: 0,
  maximum: Number.MAX_SAFE_INTEGER,
};

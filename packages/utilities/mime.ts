const JSON_CONTENT_TYPE =
  /^[\t ]*application\/json(?:[\t ]*;[\t ]*charset=utf-8)?[\t ]*$/iu;

/** Checks one HTTP Content-Type against the exact UTF-8 JSON contract. */
export function isJsonContentType(value: string | null) {
  return value !== null && JSON_CONTENT_TYPE.test(value);
}

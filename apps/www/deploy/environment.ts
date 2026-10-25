import { Record as Rec, Schema } from "effect";

/**
 * One GitHub environment's values, as the operator writes them: a JSON object of
 * names and text values. The Schema decodes only text, so a failure never shows a value.
 */
export const EnvironmentValuesSchema = Schema.fromJsonString(
  Schema.Record(Schema.String, Schema.String)
);

/**
 * A `VITE_` name is public: the client bundle inlines it, so GitHub keeps it as a
 * variable. Every other name is a secret.
 */
export const isPublicName = (name: string) => name.startsWith("VITE_");

/**
 * The values that are set. An unset value reaches here as `undefined` or as an
 * empty string, because GitHub Actions passes an unset secret as an empty string,
 * and neither is bound or written. A required value is refused by its reader,
 * which fails on the missing or empty value before this filter runs.
 */
export const setValues = (
  values: Readonly<Record<string, string | undefined>>
): Readonly<Record<string, string>> =>
  Rec.filter(
    values,
    (value): value is string => value !== undefined && value !== ""
  );

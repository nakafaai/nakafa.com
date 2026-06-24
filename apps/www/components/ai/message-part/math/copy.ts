import type { MathCopyKey, MathCopyValue } from "@repo/math/schema/copy";

/** Interpolation values accepted by the app localization seam for MathWork copy. */
export interface MathCopyParams {
  readonly [name: string]: string;
}

/** App-owned translator that resolves only schema-approved MathWork copy keys. */
export type MathCopyTranslator = (
  key: MathCopyKey,
  values?: MathCopyParams
) => string;

/** Resolves learner-facing MathWork copy through the app localization seam. */
export function translateMathCopy({
  key,
  t,
  values,
}: {
  readonly key: MathCopyKey;
  readonly t: MathCopyTranslator;
  readonly values?: readonly MathCopyValue[];
}) {
  return t(key, values ? mathCopyParams(values) : undefined);
}

/** Converts schema-owned key/value pairs into next-intl interpolation params. */
export function mathCopyParams(values: readonly MathCopyValue[]) {
  const params: { [name: string]: string } = {};

  for (const item of values) {
    params[item.name] = item.value;
  }

  return params;
}

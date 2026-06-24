import {
  type MathCopyKey,
  type MathCopyValue,
  mathEvidenceRefValueName,
} from "@repo/math/schema/copy";

type MathCopyParams = Readonly<{ readonly [name: string]: string }>;

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

/** Resolves learner copy only when it carries deterministic evidence data. */
export function translateEvidenceMathCopy({
  key,
  t,
  values,
}: {
  readonly key: MathCopyKey | undefined;
  readonly t: MathCopyTranslator;
  readonly values?: readonly MathCopyValue[];
}) {
  if (!(key && hasMathEvidenceRef(values))) {
    return;
  }

  return translateMathCopy({ key, t, values });
}

/** Returns whether copy values point at canonical MathWork evidence. */
export function hasMathEvidenceRef(values?: readonly MathCopyValue[]) {
  return values?.some(isEvidenceRefValue) ?? false;
}

/** Converts schema-owned key/value pairs into next-intl interpolation params. */
export function mathCopyParams(values: readonly MathCopyValue[]) {
  const params: { [name: string]: string } = {};

  for (const item of values) {
    params[item.name] = item.value;
  }

  return params;
}

/** Identifies the interpolation value reserved for evidence references. */
function isEvidenceRefValue(value: MathCopyValue) {
  return (
    value.name === mathEvidenceRefValueName && value.value.trim().length > 0
  );
}

import en from "@repo/internationalization/dictionaries/en.json";
import id from "@repo/internationalization/dictionaries/id.json";
import { mathStaticCopyKeyValues } from "@repo/math/schema/copy";
import { describe, expect, it } from "vitest";
import {
  hasMathEvidenceRef,
  translateEvidenceMathCopy,
  translateMathCopy,
} from "@/components/ai/message-part/math/copy";

type MathCopyParams = Readonly<{ readonly [name: string]: string }>;

describe("math copy projection", () => {
  it("resolves MathWork projection keys through English and Indonesian dictionaries", () => {
    const enText = translateMathCopy({
      key: "math-work-steps-title",
      t: dictionaryTranslator(en.Ai),
    });
    const idText = translateMathCopy({
      key: "math-work-steps-title",
      t: dictionaryTranslator(id.Ai),
    });
    const idLimitation = translateMathCopy({
      key: "math-limitation-cas-inconclusive",
      t: dictionaryTranslator(id.Ai),
      values: [{ name: "operation", value: "line" }],
    });

    expect(enText).toBe("How to get there");
    expect(idText).toBe("Cara sampai ke jawaban");
    expect(idLimitation).not.toContain("line");
    expect(idLimitation).not.toBe(en.Ai["math-limitation-cas-inconclusive"]);
  });

  it("keeps student UI copy free of internal evidence labels", () => {
    for (const key of mathStaticCopyKeyValues) {
      expect(en.Ai[key]).not.toMatch(englishTechnicalLabels);
      expect(id.Ai[key]).not.toMatch(indonesianTechnicalLabels);
    }

    expect(Object.keys(en.Ai)).not.toContain("math-evidence-title");
    expect(Object.keys(id.Ai)).not.toContain("math-evidence-title");
  });

  it("keeps every static MathWork copy key present in both dictionaries", () => {
    for (const key of mathStaticCopyKeyValues) {
      expect(en.Ai[key]).toBeTruthy();
      expect(id.Ai[key]).toBeTruthy();
    }
  });

  it("keeps math error copy short and learner-facing", () => {
    expect(id.Ai["math-error"]).toBe("Lengkapi soalnya, lalu coba lagi.");
    expect(en.Ai["math-error"]).toBe("Add the missing math, then try again.");

    for (const text of [id.Ai["math-error"], en.Ai["math-error"]]) {
      expect(text.endsWith(".")).toBe(true);
      expect(countCommas(text)).toBeLessThanOrEqual(1);
      expect(text).not.toMatch(errorCopyTechnicalLabels);
    }
  });

  it("renders evidence-gated copy without leaking raw CAS formula text", () => {
    const t = dictionaryTranslator(en.Ai);
    const values = [
      { name: "evidenceRef", value: "math:solve:test:step:0" },
      { name: "input", value: "Eq(x**2, 4)" },
      { name: "output", value: "(x - 2)*(x + 2)" },
    ];
    const text = translateEvidenceMathCopy({
      key: "math-step-solve",
      t,
      values,
    });

    expect(text).toBe("Solve the displayed equation.");
    expect(text).not.toMatch(rawFormulaLeakPattern);
    expect(hasMathEvidenceRef(values)).toBe(true);
    expect(
      translateEvidenceMathCopy({
        key: "math-step-solve",
        t,
        values: [{ name: "evidenceRef", value: " " }],
      })
    ).toBeUndefined();
    expect(
      translateEvidenceMathCopy({ key: undefined, t, values })
    ).toBeUndefined();
    expect(hasMathEvidenceRef()).toBe(false);
  });
});

const englishTechnicalLabels =
  /\b(Math evidence|MathReasoning|Verification lane|Engine|Operation|Primary|UI artifacts|Derivation steps|Status)\b/u;

const indonesianTechnicalLabels =
  /\b(Status MathReasoning|Jalur verifikasi|Mesin|Operasi|Utama|Artefak UI|Langkah penurunan)\b/u;

const errorCopyTechnicalLabels = /diagnostic|internal|MathReasoning|dicek/iu;
const rawFormulaLeakPattern = /Eq\(|\*\*|\(x - 2\)\*\(x \+ 2\)/u;

/** Builds a test translator with the same key and value contract as next-intl. */
function dictionaryTranslator(messages: { readonly [key: string]: string }) {
  /** Resolves one schema-owned copy key from a fixture dictionary. */
  function translateFromDictionary(key: string, values?: MathCopyParams) {
    const template = messages[key];
    expect(template).toBeTruthy();
    return renderTemplate(template, values);
  }

  return translateFromDictionary;
}

/** Applies simple ICU-style value replacement for dictionary projection tests. */
function renderTemplate(template: string, values?: MathCopyParams) {
  if (!values) {
    return template;
  }

  let rendered = template;
  for (const [name, value] of Object.entries(values)) {
    rendered = rendered.replaceAll(`{${name}}`, value);
  }

  return rendered;
}

/** Counts visible comma separators for concise copy assertions. */
function countCommas(value: string) {
  return value.split(",").length - 1;
}

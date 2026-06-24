import en from "@repo/internationalization/dictionaries/en.json";
import id from "@repo/internationalization/dictionaries/id.json";
import { mathStaticCopyKeyValues } from "@repo/math/schema/copy";
import { describe, expect, it } from "vitest";
import {
  type MathCopyParams,
  translateMathCopy,
} from "@/components/ai/message-part/math/copy";

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
});

const englishTechnicalLabels =
  /\b(Math evidence|MathReasoning|Verification lane|Engine|Operation|Primary|UI artifacts|Derivation steps|Status)\b/u;

const indonesianTechnicalLabels =
  /\b(Status MathReasoning|Jalur verifikasi|Mesin|Operasi|Utama|Artefak UI|Langkah penurunan)\b/u;

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

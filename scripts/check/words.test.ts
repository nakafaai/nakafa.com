import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { dictionaryFindings } from "#scripts/check/dictionary";

const DE = "packages/internationalization/dictionaries/de.json";
const EN = "packages/internationalization/dictionaries/en.json";
const STANDALONE =
  "packages/internationalization/dictionaries/standalone/en.json";

/** The finding for a key that holds the words of another key in every locale. */
function repeatMessage(line: number, keyPath: string, kept: string) {
  return `${DE}:${line}: ${keyPath} holds the words of ${kept} in every locale: read that key, or move both to Common when two namespaces share the word.`;
}

/** Two dictionaries, German and English, written from their namespaces. */
function dictionaries(de: string, en: string) {
  return dictionaryFindings([
    { file: EN, sourceText: en },
    { file: DE, sourceText: de },
  ]);
}

describe("repeated word policy", () => {
  it.effect(
    "reports a word that two namespaces hold in every locale, at each copy after the first",
    () =>
      Effect.gen(function* () {
        const findings = yield* dictionaries(
          '{\n  "Common": { "save": "Speichern" },\n  "Exams": { "save": "Speichern" }\n}\n',
          '{\n  "Common": { "save": "Save" },\n  "Exams": { "save": "Save" }\n}\n'
        );
        assert.deepStrictEqual(findings, [
          repeatMessage(3, "Exams.save", "Common.save"),
        ]);
      })
  );

  it.effect("reports a word that one namespace repeats", () =>
    Effect.gen(function* () {
      const findings = yield* dictionaries(
        '{\n  "Exams": {\n    "save": "Speichern",\n    "room-save": "Speichern"\n  }\n}\n',
        '{\n  "Exams": {\n    "save": "Save",\n    "room-save": "Save"\n  }\n}\n'
      );
      assert.deepStrictEqual(findings, [
        repeatMessage(4, "Exams.room-save", "Exams.save"),
      ]);
    })
  );

  it.effect(
    "keeps a word that one locale writes otherwise, a map's word, and a dropdown's label",
    () =>
      Effect.gen(function* () {
        const findings = yield* dictionaries(
          '{\n  "Common": { "state": "Status", "menu-state": "Status" },\n  "Exams": { "status": "Zustand", "verdict": { "state": "Status" } }\n}\n',
          '{\n  "Common": { "state": "Status", "menu-state": "Status" },\n  "Exams": { "status": "Status", "verdict": { "state": "Status" } }\n}\n'
        );
        assert.deepStrictEqual(findings, []);
      })
  );

  it.effect(
    "compares only the app dictionaries, and skips a key that one of them lacks",
    () =>
      Effect.gen(function* () {
        const findings = yield* dictionaryFindings([
          {
            file: EN,
            sourceText:
              '{ "Common": { "home": "Home" }, "Exams": { "home": "Home" } }',
          },
          {
            file: STANDALONE,
            sourceText: '{ "NotFound": { "home": "Home" } }',
          },
          { file: DE, sourceText: '{ "Common": { "home": "Startseite" } }' },
        ]);
        assert.deepStrictEqual(findings, []);
        assert.deepStrictEqual(
          yield* dictionaryFindings([
            {
              file: STANDALONE,
              sourceText: '{ "NotFound": { "home": "Home", "back": "Home" } }',
            },
          ]),
          []
        );
      })
  );
});

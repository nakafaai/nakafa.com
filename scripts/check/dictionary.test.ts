import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  dictionaryFindings,
  inspectDictionaries,
} from "#scripts/check/dictionary";
import { readAuthoredTree } from "#scripts/check/files";

/** The repository root, two folders above this test. */
const REPOSITORY = `${import.meta.dirname}/../..`;
const EN = "packages/internationalization/dictionaries/en.json";
const STANDALONE =
  "packages/internationalization/dictionaries/standalone/de.json";

/** A dictionary as the check reads it: its repository path and its JSON text. */
function source(file: string, sourceText: string) {
  return { file, sourceText };
}

/** The finding for a key that one object names again, at a line of a dictionary. */
function repeatMessage(file: string, line: number, keyPath: string) {
  return `${file}:${line}: ${keyPath} is named more than once in one object, and a JSON reader keeps only the last copy: merge the copies into one.`;
}

describe("dictionary key policy", () => {
  it.effect(
    "reports a top-level key that the dictionary names again, at the line of the copy",
    () =>
      Effect.gen(function* () {
        const findings = yield* dictionaryFindings([
          source(EN, '{\n  "Exams": {},\n  "About": {},\n  "Exams": {}\n}\n'),
        ]);
        assert.deepStrictEqual(findings, [repeatMessage(EN, 4, "Exams")]);
      })
  );

  it.effect(
    "reports a key that repeats inside a nested object, with the key path that leads to it",
    () =>
      Effect.gen(function* () {
        const findings = yield* dictionaryFindings([
          source(
            EN,
            '{\n  "Common": {\n    "Exams": {},\n    "Exams": {}\n  }\n}\n'
          ),
        ]);
        assert.deepStrictEqual(findings, [
          repeatMessage(EN, 4, "Common.Exams"),
        ]);
      })
  );

  it.effect(
    "reports every copy after the first, and a key that an escape spells",
    () =>
      Effect.gen(function* () {
        const findings = yield* dictionaryFindings([
          source(
            EN,
            '{\n  "Exams": {},\n  "\\u0045xams": {},\n  "Exams": {}\n}\n'
          ),
        ]);
        assert.deepStrictEqual(findings, [
          repeatMessage(EN, 3, "Exams"),
          repeatMessage(EN, 4, "Exams"),
        ]);
      })
  );

  it.effect(
    "accepts one key in sibling objects, and the same key in another dictionary",
    () =>
      Effect.gen(function* () {
        const findings = yield* dictionaryFindings([
          source(EN, '{"Common":{"Exams":{}},"Tryout":{"Exams":{}}}\n'),
          source(STANDALONE, '{"Exams":{}}\n'),
        ]);
        assert.deepStrictEqual(findings, []);
      })
  );

  it.effect(
    "the real repository's dictionaries name each key once",
    () =>
      Effect.gen(function* () {
        const { workspaces } = yield* readAuthoredTree(REPOSITORY);
        assert.deepStrictEqual(
          yield* inspectDictionaries(REPOSITORY, workspaces),
          []
        );
      }).pipe(Effect.provide(NodeServices.layer)),
    60_000
  );
});

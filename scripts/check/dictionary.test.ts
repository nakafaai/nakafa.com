import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Effect, HashSet } from "effect";
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
    "reports a listed message that runs past one sentence or ends without one, and passes one sentence",
    () =>
      Effect.gen(function* () {
        const findings = yield* dictionaryFindings(
          [
            source(
              EN,
              '{\n  "Memory": {\n    "empty-description": "Nothing yet. Add one",\n    "kept-description": "Nina keeps what you tell her {count, plural, one {once. Then} other {often}}."\n  }\n}\n'
            ),
          ],
          HashSet.make("Memory.empty-description", "Memory.kept-description")
        );
        assert.deepStrictEqual(findings, [
          `${EN}:3: Memory.empty-description is a description, footer, failure or answer, which takes one sentence: write it as one sentence that ends with a period, a question mark or an exclamation mark.`,
        ]);
      })
  );

  it.effect("reports a listed key that no dictionary holds", () =>
    Effect.gen(function* () {
      const findings = yield* dictionaryFindings(
        [source(EN, '{\n  "Memory": { "title": "Memory" }\n}\n')],
        HashSet.make("Memory.gone-description")
      );
      assert.deepStrictEqual(findings, [
        "scripts/check/sentences.ts: Memory.gone-description names no message in any dictionary: drop it from SENTENCE_KEYS, or add the message.",
      ]);
    })
  );

  it.effect(
    "reports a top-level key that the dictionary names again, at the line of the copy",
    () =>
      Effect.gen(function* () {
        const findings = yield* dictionaryFindings(
          [source(EN, '{\n  "Exams": {},\n  "About": {},\n  "Exams": {}\n}\n')],
          HashSet.empty()
        );
        assert.deepStrictEqual(findings, [repeatMessage(EN, 4, "Exams")]);
      })
  );

  it.effect(
    "reports a key that repeats inside a nested object, with the key path that leads to it",
    () =>
      Effect.gen(function* () {
        const findings = yield* dictionaryFindings(
          [
            source(
              EN,
              '{\n  "Common": {\n    "Exams": {},\n    "Exams": {}\n  }\n}\n'
            ),
          ],
          HashSet.empty()
        );
        assert.deepStrictEqual(findings, [
          repeatMessage(EN, 4, "Common.Exams"),
        ]);
      })
  );

  it.effect(
    "reports every copy after the first, and a key that an escape spells",
    () =>
      Effect.gen(function* () {
        const findings = yield* dictionaryFindings(
          [
            source(
              EN,
              '{\n  "Exams": {},\n  "\\u0045xams": {},\n  "Exams": {}\n}\n'
            ),
          ],
          HashSet.empty()
        );
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
        const findings = yield* dictionaryFindings(
          [
            source(EN, '{"Common":{"Exams":{}},"Tryout":{"Exams":{}}}\n'),
            source(STANDALONE, '{"Exams":{}}\n'),
          ],
          HashSet.empty()
        );
        assert.deepStrictEqual(findings, []);
      })
  );

  it.effect(
    "reports a dropdown label of more than one word and accepts one word",
    () =>
      Effect.gen(function* () {
        const findings = yield* dictionaryFindings(
          [
            source(
              EN,
              '{\n  "Common": {\n    "menu-actions": "Actions",\n    "menu-class": "Your class",\n    "menu": "Main menu",\n    "menu-nested": { "label": "Two words" }\n  }\n}\n'
            ),
          ],
          HashSet.empty()
        );
        assert.deepStrictEqual(findings, [
          `${EN}:4: Common.menu-class labels a dropdown, which names what is chosen in one word: shorten it to one word.`,
        ]);
      })
  );

  it.effect(
    "reports what an empty list says in more than one sentence and accepts one sentence or a title",
    () =>
      Effect.gen(function* () {
        const findings = yield* dictionaryFindings(
          [
            source(
              EN,
              '{\n  "Common": {\n    "search-empty": "No match found.",\n    "class-empty": "No class yet",\n    "people-empty": "No one is free. Add one in Accounts.",\n    "empty": "Nothing here! Try again.",\n    "empty-description": "One. Two.",\n    "exam-empty": { "label": "One. Two." }\n  }\n}\n'
            ),
          ],
          HashSet.empty()
        );
        assert.deepStrictEqual(findings, [
          `${EN}:5: Common.people-empty says what an empty list holds, which takes one sentence: join or cut it to one sentence.`,
          `${EN}:6: Common.empty says what an empty list holds, which takes one sentence: join or cut it to one sentence.`,
        ]);
      })
  );

  it.effect(
    "reports a value that speaks formally in its dictionary's language and accepts the casual one",
    () =>
      Effect.gen(function* () {
        const DE = "packages/internationalization/dictionaries/de.json";
        const ID = "packages/internationalization/dictionaries/id.json";
        const MS = "packages/internationalization/dictionaries/ms.json";
        const fixes = {
          de: "write du, dich, dir or dein, and name the noun where a sentence opens with Sie or Ihr",
          id: "write kamu or -mu for the reader and aku or -ku for the speaker, ask with the plain imperative, and say itu for tersebut",
          ms: "write kamu or -mu for the reader",
        };
        const formal = (
          file: string,
          line: number,
          keyPath: string,
          fix: string
        ) =>
          `${file}:${line}: ${keyPath} speaks formally, and Nakafa talks to one learner like a teacher in every language: ${fix}.`;
        const findings = yield* dictionaryFindings(
          [
            source(
              DE,
              '{\n  "Exams": {\n    "gone": "Diese Prüfung ist für Sie geschlossen.",\n    "delete": "Ihre Fragen werden gelöscht.",\n    "help": "Ihnen hilft die Schule.",\n    "closed": "Sie nimmt keine Antworten mehr an.",\n    "own": "Dein Ergebnis bleibt, auch wenn sie endet.",\n    "brand": "Siemens und Ihringen bleiben Namen."\n  }\n}\n'
            ),
            source(
              ID,
              '{\n  "Guardians": {\n    "note": "Catatan Anda",\n    "home": "Anak saya",\n    "retry": "Silakan coba lagi.",\n    "ask": "Mohon isi namamu.",\n    "that": "Masuk dengan akun tersebut.",\n    "class": "Kalian bisa mulai.",\n    "casual": "Catatanmu tersimpan, jadi kamu bisa lanjut kapan saja.",\n    "words": "Permohonan dari Panda sudah aku terima."\n  }\n}\n'
            ),
            source(
              MS,
              '{\n  "home": "Markah anda",\n  "casual": "Markah kamu"\n}\n'
            ),
            source(EN, '{\n  "gone": "Sie means she in German."\n}\n'),
          ],
          HashSet.empty()
        );
        assert.deepStrictEqual(findings, [
          formal(DE, 3, "Exams.gone", fixes.de),
          formal(DE, 4, "Exams.delete", fixes.de),
          formal(DE, 5, "Exams.help", fixes.de),
          formal(DE, 6, "Exams.closed", fixes.de),
          formal(ID, 3, "Guardians.note", fixes.id),
          formal(ID, 4, "Guardians.home", fixes.id),
          formal(ID, 5, "Guardians.retry", fixes.id),
          formal(ID, 6, "Guardians.ask", fixes.id),
          formal(ID, 7, "Guardians.that", fixes.id),
          formal(ID, 8, "Guardians.class", fixes.id),
          formal(MS, 2, "home", fixes.ms),
        ]);
      })
  );

  it.effect(
    "the real repository's dictionaries pass every rule",
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

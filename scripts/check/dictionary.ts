import {
  Array as Arr,
  Effect,
  FileSystem,
  HashSet,
  Option,
  Path,
  Schema,
  String as Str,
} from "effect";
import {
  isObjectLiteralExpression,
  isPropertyAssignment,
  isPropertyNameLiteral,
  isStringLiteral,
  type Node,
  type ObjectLiteralExpression,
  type PropertyAssignment,
  type PropertyNameLiteral,
  type SourceFile,
} from "tsrs/ast";
import { RepositoryReadError } from "#scripts/check/files";
import {
  holdsSecondSentence,
  isOneSentence,
  SENTENCE_KEYS,
} from "#scripts/check/sentences";
import {
  children,
  parseSources,
  type RepositorySource,
} from "#scripts/check/source";

/** The dictionaries, standalone ones included: every JSON file below the internationalization dictionaries. */
const DICTIONARY_FILE_PATTERN =
  /^packages\/internationalization\/dictionaries\/(?:.+\/)?[^/]+\.json$/u;

/**
 * A key that names a dropdown's label. Every dropdown and select opens with one word that names what is chosen, and
 * the label reads one of these keys, so a key of this family holds one word in every language.
 */
const MENU_KEY_PATTERN = /^menu-/u;
const ONE_WORD_PATTERN = /^\S+$/u;
/**
 * A key that names what an empty list says, such as a picker's empty slot. It says it in one sentence at most, so a
 * key of this family never holds a second sentence after the first one ends.
 */
const EMPTY_KEY_PATTERN = /(?:^|-)empty$/u;
/** The language of a dictionary, the name of its file, such as `de` in `standalone/de.json`. */
const LANGUAGE_PATTERN = /(?<language>[^/]+)\.json$/u;

/**
 * The formal words of each language, with the casual words that replace them. Nakafa talks to one learner the way a
 * teacher does, in every language and on every screen, so no value addresses the reader formally. German refuses every
 * capitalized `Sie` and `Ihr`, the ones that refer back to a noun included: a value is read alone, under a title the
 * reader may not connect it to, so it names the noun instead. English has no formal pronoun.
 */
const FormalLanguage = Schema.Literals(["de", "id", "ms"]);
const FORMAL_WORDS = {
  de: {
    fix: "write du, dich, dir or dein, and name the noun where a sentence opens with Sie or Ihr",
    pattern: /\b(?:Sie|Ihnen|Ihre?[mnrs]?)\b/u,
  },
  id: {
    fix: "write kamu or -mu for the reader and aku or -ku for the speaker, ask with the plain imperative, and say itu for tersebut",
    pattern:
      /\b(?:anda|saya|kalian|silakan|silahkan|mohon|dimohon|tersebut)\b/iu,
  },
  ms: {
    fix: "write kamu or -mu for the reader",
    pattern: /\banda\b/iu,
  },
};

/** A key that an object names again after its first copy, with the key path to that object. */
const RepeatedKey = Schema.Struct({
  keyPath: Schema.String,
  line: Schema.Int,
});

/**
 * Whether a property names its key with a literal, such as `"Exams": {}`. The
 * text of a literal is its decoded value, so `"Exams"` names `Exams`.
 */
function isNamedProperty(
  node: Node
): node is PropertyAssignment & { readonly name: PropertyNameLiteral } {
  return isPropertyAssignment(node) && isPropertyNameLiteral(node.name);
}

/**
 * Wraps a dictionary in parentheses, so that the native parser reads it as one
 * object literal. The wrapper stays on the first line, so every line keeps its
 * number.
 */
function asExpression(sourceText: string) {
  return `(${sourceText})`;
}

/**
 * Lists the keys that one object names after their first copy. The key path
 * joins the keys of the objects that enclose this one, so a repeat inside
 * `Common` reads `Common.Exams`.
 */
function repeatsIn(
  sourceFile: SourceFile,
  object: ObjectLiteralExpression,
  path: readonly string[]
): readonly (typeof RepeatedKey.Type)[] {
  const named = Arr.filter(object.properties, isNamedProperty);
  return Arr.flatMap(named, (property, index) =>
    Arr.some(
      Arr.take(named, index),
      (earlier) => earlier.name.text === property.name.text
    )
      ? [
          {
            keyPath: Arr.join(Arr.append(path, property.name.text), "."),
            line:
              sourceFile.getLineAndCharacterOfPosition(
                property.getStart(sourceFile)
              ).line + 1,
          },
        ]
      : []
  );
}

/**
 * Collects the repeated keys of every object below `node`. A named property
 * extends the key path of its value. An object inside an array reads the path
 * of the property that holds the array.
 */
function repeatedKeys(
  sourceFile: SourceFile,
  node: Node,
  path: readonly string[]
): readonly (typeof RepeatedKey.Type)[] {
  const valuePath = isNamedProperty(node)
    ? Arr.append(path, node.name.text)
    : path;
  const repeats = isObjectLiteralExpression(node)
    ? repeatsIn(sourceFile, node, path)
    : [];
  return Arr.appendAll(
    repeats,
    Arr.flatMap(children(node), (child) =>
      repeatedKeys(sourceFile, child, valuePath)
    )
  );
}

/** A family of keys, named by a key and its dotted path, and the test that a value of the family fails. */
interface ValueRule {
  readonly covers: (key: string, keyPath: string) => boolean;
  readonly strays: (value: string) => boolean;
}

/** A dropdown's label holds one word. */
const MENU_RULE: ValueRule = {
  covers: (key) => MENU_KEY_PATTERN.test(key),
  strays: (value) => !ONE_WORD_PATTERN.test(value),
};

/** What an empty list says holds one sentence at most. */
const EMPTY_RULE: ValueRule = {
  covers: (key) => EMPTY_KEY_PATTERN.test(key),
  strays: holdsSecondSentence,
};

/** A listed message (see `SENTENCE_KEYS`) is one sentence that ends with a period, a question mark or an exclamation mark. */
function sentenceRule(listed: HashSet.HashSet<string>): ValueRule {
  return {
    covers: (_key, keyPath) => HashSet.has(listed, keyPath),
    strays: (value) => !isOneSentence(value),
  };
}

/** Every value: a rule of this family reads all of a dictionary. */
const EVERY_VALUE: ValueRule = {
  covers: () => true,
  strays: () => true,
};

/**
 * Collects the values below `node` whose key belongs to the rule's family and that fail its test, with the key path
 * that leads to each.
 */
function strayValues(
  sourceFile: SourceFile,
  node: Node,
  path: readonly string[],
  rule: ValueRule
): readonly (typeof RepeatedKey.Type)[] {
  const named = isNamedProperty(node);
  const valuePath = named ? Arr.append(path, node.name.text) : path;
  const stray =
    named &&
    rule.covers(node.name.text, Arr.join(valuePath, ".")) &&
    isStringLiteral(node.initializer) &&
    rule.strays(node.initializer.text)
      ? [
          {
            keyPath: Arr.join(valuePath, "."),
            line:
              sourceFile.getLineAndCharacterOfPosition(
                node.getStart(sourceFile)
              ).line + 1,
          },
        ]
      : [];
  return Arr.appendAll(
    stray,
    Arr.flatMap(children(node), (child) =>
      strayValues(sourceFile, child, valuePath, rule)
    )
  );
}

/** Reports each value of one dictionary that speaks formally in the dictionary's language. */
function formalFindings(file: string, sourceFile: SourceFile) {
  const language = Option.filter(
    Option.fromNullishOr(LANGUAGE_PATTERN.exec(file)?.groups?.language),
    Schema.is(FormalLanguage)
  );
  return Option.match(language, {
    onNone: () => [],
    onSome: (code) => {
      const { fix, pattern } = FORMAL_WORDS[code];
      return Arr.map(
        strayValues(sourceFile, sourceFile, [], {
          covers: () => true,
          strays: (value) => pattern.test(value),
        }),
        ({ keyPath, line }) =>
          `${file}:${line}: ${keyPath} speaks formally, and Nakafa talks to one learner like a teacher in every language: ${fix}.`
      );
    },
  });
}

/**
 * Reports each key that a dictionary object names more than once, at the line
 * of every copy after the first. A JSON reader keeps only the last copy, so a
 * merge that adds the same object twice would drop one of them with no error.
 * It also reports a dropdown's label that holds more than one word, since a label
 * names what is chosen in one word in every language, an empty list's words
 * that run past one sentence, a value that speaks formally, a `listed` message
 * that is not one sentence, and a `listed` key that no dictionary holds.
 */
export const dictionaryFindings = Effect.fn(
  "RepositoryPolicy.dictionaryFindings"
)(function* (
  sources: readonly (typeof RepositorySource.Type)[],
  listed: HashSet.HashSet<string>
) {
  const parsed = yield* parseSources(
    Arr.map(sources, ({ file, sourceText }) => ({
      file,
      sourceText: asExpression(sourceText),
    }))
  );
  const held = HashSet.fromIterable(
    Arr.flatMap(parsed.modules, ({ sourceFile }) =>
      Arr.map(
        strayValues(sourceFile, sourceFile, [], EVERY_VALUE),
        ({ keyPath }) => keyPath
      )
    )
  );
  const unheld = Arr.map(
    Arr.filter(Arr.fromIterable(listed), (key) => !HashSet.has(held, key)),
    (key) =>
      `scripts/check/sentences.ts: ${key} names no message in any dictionary: drop it from SENTENCE_KEYS, or add the message.`
  );
  const perFile = Arr.flatMap(parsed.modules, ({ file, sourceFile }) =>
    Arr.flatten([
      formalFindings(file, sourceFile),
      Arr.map(
        repeatedKeys(sourceFile, sourceFile, []),
        ({ keyPath, line }) =>
          `${file}:${line}: ${keyPath} is named more than once in one object, and a JSON reader keeps only the last copy: merge the copies into one.`
      ),
      Arr.map(
        strayValues(sourceFile, sourceFile, [], MENU_RULE),
        ({ keyPath, line }) =>
          `${file}:${line}: ${keyPath} labels a dropdown, which names what is chosen in one word: shorten it to one word.`
      ),
      Arr.map(
        strayValues(sourceFile, sourceFile, [], EMPTY_RULE),
        ({ keyPath, line }) =>
          `${file}:${line}: ${keyPath} says what an empty list holds, which takes one sentence: join or cut it to one sentence.`
      ),
      Arr.map(
        strayValues(sourceFile, sourceFile, [], sentenceRule(listed)),
        ({ keyPath, line }) =>
          `${file}:${line}: ${keyPath} is a description, footer, failure or answer, which takes one sentence: write it as one sentence that ends with a period, a question mark or an exclamation mark.`
      ),
    ])
  );
  return Arr.appendAll(perFile, unheld);
}, Effect.scoped);

/**
 * Reads the dictionary files among `files` and reports their repeated keys.
 * Each file is named by its repository path, as the other checks name files.
 */
export const inspectDictionaries = Effect.fn(
  "RepositoryPolicy.inspectDictionaries"
)(function* (root: string, files: readonly string[]) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const relativePath = (file: string) =>
    Arr.join(Str.split(path.relative(root, file), path.sep), "/");
  const dictionaries = Arr.filter(files, (file) =>
    DICTIONARY_FILE_PATTERN.test(relativePath(file))
  );
  const sources = yield* Effect.forEach(dictionaries, (file) =>
    Effect.map(
      fileSystem.readFileString(file).pipe(
        Effect.mapError(
          (cause) =>
            new RepositoryReadError({
              cause,
              message: `Unable to read ${file}.`,
            })
        )
      ),
      (sourceText): typeof RepositorySource.Type => ({
        file: relativePath(file),
        sourceText,
      })
    )
  );
  return yield* dictionaryFindings(sources, SENTENCE_KEYS);
});

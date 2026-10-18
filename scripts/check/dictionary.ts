import {
  Array as Arr,
  Effect,
  FileSystem,
  Path,
  Schema,
  String as Str,
} from "effect";
import {
  isObjectLiteralExpression,
  isPropertyAssignment,
  isPropertyNameLiteral,
  type Node,
  type ObjectLiteralExpression,
  type PropertyAssignment,
  type PropertyNameLiteral,
  type SourceFile,
} from "typescript/unstable/ast";
import { RepositoryReadError } from "#scripts/check/files";
import {
  children,
  parseSources,
  type RepositorySource,
} from "#scripts/check/source";

/** The dictionaries, standalone ones included: every JSON file below the internationalization dictionaries. */
const DICTIONARY_FILE_PATTERN =
  /^packages\/internationalization\/dictionaries\/(?:.+\/)?[^/]+\.json$/u;

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

/**
 * Reports each key that a dictionary object names more than once, at the line
 * of every copy after the first. A JSON reader keeps only the last copy, so a
 * merge that adds the same object twice would drop one of them with no error.
 */
export const dictionaryFindings = Effect.fn(
  "RepositoryPolicy.dictionaryFindings"
)(function* (sources: readonly (typeof RepositorySource.Type)[]) {
  const parsed = yield* parseSources(
    Arr.map(sources, ({ file, sourceText }) => ({
      file,
      sourceText: asExpression(sourceText),
    }))
  );
  return Arr.flatMap(parsed.modules, ({ file, sourceFile }) =>
    Arr.map(
      repeatedKeys(sourceFile, sourceFile, []),
      ({ keyPath, line }) =>
        `${file}:${line}: ${keyPath} is named more than once in one object, and a JSON reader keeps only the last copy: merge the copies into one.`
    )
  );
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
  return yield* dictionaryFindings(sources);
});

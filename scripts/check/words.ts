import {
  Array as Arr,
  HashMap,
  Option,
  Order,
  Record as Rec,
  Result,
  Schema,
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
import { children } from "#scripts/check/source";

/** The app dictionaries, one per locale. The standalone ones load apart from them, so a word may stand in both. */
const APP_DICTIONARY_PATTERN =
  /^packages\/internationalization\/dictionaries\/[^/]+\.json$/u;

/** A dropdown's label, which `menus.ts` requires a label to read, so it may name a word that another key holds. */
const MENU_KEY_PATTERN = /^menu-/u;

/** One word of a namespace: the key path that names it, its text and its line. */
const Word = Schema.Struct({
  keyPath: Schema.String,
  line: Schema.Int,
  text: Schema.String,
});

/** The outermost object literals at or below `node`: the one dictionary that the parentheses wrap. */
function rootObjects(node: Node): readonly ObjectLiteralExpression[] {
  return isObjectLiteralExpression(node)
    ? [node]
    : Arr.flatMap(children(node), rootObjects);
}

/**
 * Whether a property names its key with a literal, such as `"Exams": {}`. The
 * text of a literal is its decoded value, so `"Exams"` names `Exams`.
 */
export function isNamedProperty(
  node: Node
): node is PropertyAssignment & { readonly name: PropertyNameLiteral } {
  return isPropertyAssignment(node) && isPropertyNameLiteral(node.name);
}

/** The properties of one object literal that name their key with a literal. */
function namedProperties(object: ObjectLiteralExpression) {
  return Arr.filter(object.properties, isNamedProperty);
}

/**
 * The words that each namespace holds as its own keys. A nested object is a map
 * that code reads by a value, such as a status or a kind, and it names every
 * value of its domain, so its words are not compared.
 */
function namespaceWords(sourceFile: SourceFile) {
  return Arr.flatMap(rootObjects(sourceFile), (root) =>
    Arr.flatMap(namedProperties(root), (namespace) =>
      isObjectLiteralExpression(namespace.initializer)
        ? Arr.flatMap(namedProperties(namespace.initializer), (word) =>
            isStringLiteral(word.initializer) &&
            !MENU_KEY_PATTERN.test(word.name.text)
              ? [
                  {
                    keyPath: `${namespace.name.text}.${word.name.text}`,
                    line:
                      sourceFile.getLineAndCharacterOfPosition(
                        word.getStart(sourceFile)
                      ).line + 1,
                    text: word.initializer.text,
                  } satisfies typeof Word.Type,
                ]
              : []
          )
        : []
    )
  );
}

/**
 * Reports each word that two keys of the app dictionaries hold in every locale.
 * A word that one namespace repeats keeps one key; a word that two namespaces
 * share lives once in Common, which every page loads. A key whose text differs
 * in any one locale is a different word there, so it stays. The finding names
 * the dictionary that sorts first, at the line of every key after the first.
 */
export function repeatedWords(
  modules: readonly {
    readonly file: string;
    readonly sourceFile: SourceFile;
  }[]
) {
  const dictionaries = Arr.sort(
    Arr.filter(modules, ({ file }) => APP_DICTIONARY_PATTERN.test(file)),
    Order.mapInput(Order.String, ({ file }: { readonly file: string }) => file)
  );
  return Option.match(Arr.head(dictionaries), {
    onNone: () => [],
    onSome: (first) => {
      const others = Arr.map(Arr.drop(dictionaries, 1), ({ sourceFile }) =>
        HashMap.fromIterable(
          Arr.map(namespaceWords(sourceFile), (word) => [
            word.keyPath,
            word.text,
          ])
        )
      );
      const groups = Arr.groupBy(
        Arr.filterMap(namespaceWords(first.sourceFile), (word) =>
          Option.match(
            Option.all(
              Arr.map(others, (words) => HashMap.get(words, word.keyPath))
            ),
            {
              onNone: () => Result.failVoid,
              onSome: (texts) =>
                Result.succeed({
                  word,
                  words: Arr.join(Arr.prepend(texts, word.text), "\u0000"),
                }),
            }
          )
        ),
        ({ words }) => words
      );
      return Arr.flatMap(Rec.values(groups), (group) => {
        const kept = Arr.headNonEmpty(group).word.keyPath;
        return Arr.map(
          Arr.drop(group, 1),
          ({ word }) =>
            `${first.file}:${word.line}: ${word.keyPath} holds the words of ${kept} in every locale: read that key, or move both to Common when two namespaces share the word.`
        );
      });
    },
  });
}

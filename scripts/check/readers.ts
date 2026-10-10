import {
  Array as Arr,
  HashSet,
  MutableList,
  Option,
  String as Str,
} from "effect";
import {
  isCallExpression,
  isExportDeclaration,
  isExternalModuleReference,
  isIdentifier,
  isImportDeclaration,
  isImportEqualsDeclaration,
  isImportTypeNode,
  isLiteralTypeNode,
  isNamespaceExport,
  isPropertyAccessExpression,
  isStringLiteralLikeNode,
  type Node,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";

/**
 * The stem of a module specifier that the program computes, such as the path of
 * `import(name)`. Such a specifier may name any module, so its reader is taken
 * to read every name that it holds in code.
 */
const COMPUTED = "*";
/** The `vi` methods whose first argument is the path of a module. */
const VI_MODULE_METHODS = HashSet.make(
  "doMock",
  "doUnmock",
  "importActual",
  "importMock",
  "mock",
  "unmock"
);
/** A path up to and including its last "/", which the file name follows. */
const DIRECTORY_PATTERN = /^.*\//u;
/** The last "/" segment of a repository path, which names its folder. */
const LAST_SEGMENT_PATTERN = /\/[^/]+$/u;
/** The script extension that a module specifier leaves out of the file it names. */
const SCRIPT_EXTENSION_PATTERN = /\.(?:js|tsx?)$/u;

/**
 * Returns whether an authored module reads an export of another module, judged
 * from its syntax tree and for the declared `names` only. The result takes the
 * `stems` of the module that declares the export and the export's `name`: the
 * module reads it when it forwards that module with `export *`, or when it loads
 * that module and holds `name` in code. Every node is visited, so a comment is
 * never a reader, and a module specifier counts only where the grammar loads a
 * module by it. A namespace module (see `namespaceStems`) is read by word alone,
 * because its namespace object reaches the reader without a specifier.
 */
export function exportReader(
  sourceFile: SourceFile,
  names: HashSet.HashSet<string>,
  namespaces: HashSet.HashSet<string>
) {
  const nodes = nodesOf(sourceFile);
  const words = HashSet.fromIterable(
    Arr.flatMap(nodes, (node) => namedWords(node, names))
  );
  const loads = HashSet.fromIterable(
    Arr.flatMap(nodes, (node) =>
      Arr.fromOption(Option.map(loadedSpecifier(node), stemOf))
    )
  );
  const forwards = HashSet.fromIterable(
    Arr.flatMap(nodes, (node) =>
      Arr.fromOption(Option.map(forwardedSpecifier(node), stemOf))
    )
  );
  return (stems: readonly string[], name: string): boolean => {
    if (isNamespaced(namespaces, stems)) {
      return HashSet.has(words, name);
    }
    if (Arr.some(stems, (stem) => HashSet.has(forwards, stem))) {
      return true;
    }
    const loadsModule =
      Arr.some(stems, (stem) => HashSet.has(loads, stem)) ||
      HashSet.has(loads, COMPUTED);
    return loadsModule && HashSet.has(words, name);
  };
}

/**
 * The stems of the modules that a runtime `import()` in one module loads, or
 * COMPUTED for a path the program computes. The namespace object that such an
 * import resolves to can be read in any module, by a property access on the
 * value that a loader function returns, so no module specifier shows the read.
 */
export function namespaceStems(sourceFile: SourceFile): readonly string[] {
  return Arr.flatMap(nodesOf(sourceFile), (node) =>
    isCallExpression(node) && node.expression.kind === SyntaxKind.ImportKeyword
      ? Arr.fromOption(Option.map(Arr.head(node.arguments), stemOf))
      : []
  );
}

/**
 * The names by which a module specifier names the module at `file`: its file
 * name without the script extension. An `index` module is also named by its
 * folder, because `./shop` and `./shop/index` load the same module.
 */
export function fileStems(file: string): readonly string[] {
  const stem = stemOfPath(file);
  return stem === "index"
    ? [stemOfPath(Str.replace(LAST_SEGMENT_PATTERN, "")(file)), stem]
    : [stem];
}

/** Whether a dynamic import loads one of the stems, or a computed path that may load any module. */
function isNamespaced(
  namespaces: HashSet.HashSet<string>,
  stems: readonly string[]
): boolean {
  return (
    HashSet.has(namespaces, COMPUTED) ||
    Arr.some(stems, (stem) => HashSet.has(namespaces, stem))
  );
}

/** Every node of a module in source order. Trivia such as a comment holds no node. */
function nodesOf(sourceFile: SourceFile): readonly Node[] {
  const nodes = MutableList.make<Node>();
  const visit = (node: Node): void => {
    MutableList.append(nodes, node);
    node.forEachChild(visit);
  };
  visit(sourceFile);
  return MutableList.toArray(nodes);
}

/** The declared name that a node holds in code as an identifier or a string, as a list of at most one. */
function namedWords(
  node: Node,
  names: HashSet.HashSet<string>
): readonly string[] {
  return (isIdentifier(node) || isStringLiteralLikeNode(node)) &&
    HashSet.has(names, node.text)
    ? [node.text]
    : [];
}

/** The module specifier that a node loads a module by, when it loads one. */
function loadedSpecifier(node: Node): Option.Option<Node> {
  if (isImportDeclaration(node) || isExportDeclaration(node)) {
    return Option.fromNullishOr(node.moduleSpecifier);
  }
  if (
    isImportEqualsDeclaration(node) &&
    isExternalModuleReference(node.moduleReference)
  ) {
    return Option.some(node.moduleReference.expression);
  }
  if (isImportTypeNode(node) && isLiteralTypeNode(node.argument)) {
    return Option.some(node.argument.literal);
  }
  if (isCallExpression(node) && isLoader(node.expression)) {
    // A nested call such as `import()` in `vi.mock(import(...))` loads on its own.
    return Option.filter(
      Arr.head(node.arguments),
      (argument) => !isCallExpression(argument)
    );
  }
  return Option.none();
}

/** The module specifier of `export *` and `export * as`, which forward every name of their module. */
function forwardedSpecifier(node: Node): Option.Option<Node> {
  return isExportDeclaration(node) &&
    (node.exportClause === undefined || isNamespaceExport(node.exportClause))
    ? Option.fromNullishOr(node.moduleSpecifier)
    : Option.none();
}

/** Whether a callee loads a module by its first argument: `import`, `require`, or a `vi` method that takes a module path. */
function isLoader(callee: Node): boolean {
  return (
    callee.kind === SyntaxKind.ImportKeyword ||
    (isIdentifier(callee) && callee.text === "require") ||
    (isPropertyAccessExpression(callee) &&
      isIdentifier(callee.expression) &&
      callee.expression.text === "vi" &&
      HashSet.has(VI_MODULE_METHODS, callee.name.text))
  );
}

/** The stem of a module specifier, or COMPUTED when the specifier is an expression. */
function stemOf(specifier: Node): string {
  return isStringLiteralLikeNode(specifier)
    ? stemOfPath(specifier.text)
    : COMPUTED;
}

/** The file name of a path or a module specifier, without its directory and script extension. */
function stemOfPath(path: string): string {
  return Str.replace(
    SCRIPT_EXTENSION_PATTERN,
    ""
  )(Str.replace(DIRECTORY_PATTERN, "")(path));
}

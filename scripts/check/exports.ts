import {
  Array as Arr,
  Effect,
  FileSystem,
  HashMap,
  HashSet,
  Option,
  Path,
  Result,
  Schema,
  String as Str,
} from "effect";
import {
  isClassDeclaration,
  isEnumDeclaration,
  isExportDeclaration,
  isFunctionDeclaration,
  isIdentifier,
  isInterfaceDeclaration,
  isNamedExports,
  isTypeAliasDeclaration,
  isVariableStatement,
  type Node,
  type SourceFile,
  type Statement,
  SyntaxKind,
} from "typescript/unstable/ast";
import { RepositoryReadError } from "#scripts/check/files";
import { isGenerated, type RepositorySource } from "#scripts/check/source";

/** Everything between two words. A word is a run of identifier characters. */
const WORD_BREAK_PATTERN = /[^\w$]+/u;
/**
 * Modules whose exports a framework reads by name, so no module imports them:
 * the Next.js file conventions inside the `app` directory of an app and at its
 * root, and the Vercel project configuration.
 */
const FRAMEWORK_MODULE_PATTERNS = [
  /^apps\/[^/]+\/app\/(?:.+\/)?(?:apple-icon|default|error|forbidden|global-error|global-not-found|icon|layout|loading|manifest|not-found|opengraph-image|page|robots|route|sitemap|template|twitter-image|unauthorized)\.tsx?$/u,
  /^apps\/[^/]+\/(?:instrumentation|instrumentation-client|mdx-components|proxy|vercel)\.tsx?$/u,
];
/** The shadcn component set, which keeps every part that its upstream ships. */
const COMPONENT_SET_DIRECTORY = "packages/design-system/components/ui/";

/** The manifest of one workspace, by repository-relative path. */
const WORKSPACE_MANIFEST_PATTERN = /^(?:apps|packages)\/[^/]+\/package\.json$/u;
const MANIFEST_FILE = "package.json";
/** What a manifest says about publication: a package is published unless it is private. */
const WorkspaceManifest = Schema.fromJsonString(
  Schema.Struct({ private: Schema.optionalKey(Schema.Boolean) })
);

/**
 * Returns the directories of the workspaces among `files` that are published
 * as packages, each with a trailing "/". Another repository reads the exports
 * of a published package, so this repository cannot tell which ones are unused.
 */
export const publishedDirectories = Effect.fn(
  "RepositoryPolicy.publishedDirectories"
)(function* (root: string, files: readonly string[]) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const manifests = Arr.filter(
    Arr.map(files, (file) =>
      Arr.join(Str.split(path.relative(root, file), path.sep), "/")
    ),
    (file) => WORKSPACE_MANIFEST_PATTERN.test(file)
  );
  const published = yield* Effect.filter(manifests, (file) =>
    fileSystem.readFileString(path.join(root, file)).pipe(
      Effect.flatMap(Schema.decodeEffect(WorkspaceManifest)),
      Effect.map((manifest) => manifest.private !== true),
      Effect.mapError(
        (cause) =>
          new RepositoryReadError({
            cause,
            message: `Unable to read ${file} as a package manifest.`,
          })
      )
    )
  );
  return Arr.map(published, (file) =>
    Str.slice(0, file.length - MANIFEST_FILE.length)(file)
  );
});

/** What a compiler configuration says about declaration output. */
const DeclarationConfig = Schema.fromJsonString(
  Schema.Struct({
    compilerOptions: Schema.Struct({ declaration: Schema.Literal(true) }),
  })
);
const decodeDeclarationConfig = Schema.decodeUnknownOption(DeclarationConfig);
/** A top-level statement that exports: a declaration, a list, or the default. */
const EXPORT_STATEMENT_PATTERN = /^export\b/u;

/**
 * Whether a compiler configuration of the repository turns declaration output
 * on. The compiler then rejects an exported declaration whose type names a
 * declaration that is not exported, so such a name has to stay exported.
 */
export function emitsDeclarations(
  configs: readonly (typeof RepositorySource.Type)[]
) {
  return Arr.some(configs, ({ sourceText }) =>
    Option.isSome(decodeDeclarationConfig(sourceText))
  );
}

/**
 * Whether another exporting statement of the module mentions `name`. With
 * declaration output on, such a name is part of that statement's signature.
 */
function namedByExport(sourceFile: SourceFile, owner: Statement, name: string) {
  return Arr.some(sourceFile.statements, (statement) => {
    const text = Str.slice(
      statement.getStart(sourceFile),
      statement.end
    )(sourceFile.text);
    return (
      statement !== owner &&
      EXPORT_STATEMENT_PATTERN.test(text) &&
      Arr.contains(Str.split(text, WORD_BREAK_PATTERN), name)
    );
  });
}

/** Whether a declaration carries `export` without `default`. */
function exportsByName(modifiers: readonly Node[] | undefined) {
  const kinds = Arr.map(modifiers ?? [], ({ kind }) => kind);
  return (
    Arr.contains(kinds, SyntaxKind.ExportKeyword) &&
    !Arr.contains(kinds, SyntaxKind.DefaultKeyword)
  );
}

/**
 * Returns the names that one top-level statement exports. A default export has
 * no name to import, a re-export belongs to the module it names, and a
 * destructured export is left to review.
 */
function exportedNames(statement: Statement): readonly string[] {
  if (isExportDeclaration(statement)) {
    return statement.moduleSpecifier === undefined &&
      statement.exportClause !== undefined &&
      isNamedExports(statement.exportClause)
      ? Arr.filter(
          Arr.map(statement.exportClause.elements, ({ name }) => name.text),
          (name) => name !== "default"
        )
      : [];
  }
  if (isVariableStatement(statement)) {
    return exportsByName(statement.modifiers)
      ? Arr.filterMap(statement.declarationList.declarations, ({ name }) =>
          isIdentifier(name) ? Result.succeed(name.text) : Result.failVoid
        )
      : [];
  }
  if (
    isFunctionDeclaration(statement) ||
    isClassDeclaration(statement) ||
    isInterfaceDeclaration(statement) ||
    isTypeAliasDeclaration(statement) ||
    isEnumDeclaration(statement)
  ) {
    return exportsByName(statement.modifiers)
      ? Arr.map(Arr.fromNullishOr(statement.name), ({ text }) => text)
      : [];
  }
  return [];
}

/**
 * Reports an exported name that no other module mentions. An export is the
 * interface of its module, so a name that nothing imports is not interface: it
 * loses `export`, and the formatter then reports the declaration when its own
 * module does not use it either.
 *
 * `texts` holds the text of every module that can name an export: authored,
 * generated, and declaration files alike. A name counts as mentioned when the
 * word appears in a second text, so the rule never reports a name that
 * something imports, and it misses an unused name that another module happens
 * to spell. `published` lists the directories of the workspaces that are
 * published as packages, whose exports another repository reads. With
 * `declarations`, a name that another exporting statement of its own module
 * mentions is left alone, because the compiler may need it in that signature.
 */
export function inspectExports(
  modules: readonly {
    readonly file: string;
    readonly sourceFile: SourceFile;
  }[],
  texts: readonly string[],
  published: readonly string[],
  declarations: boolean
): readonly string[] {
  const declared = Arr.flatMap(modules, ({ file, sourceFile }) =>
    isGenerated(sourceFile) ||
    Str.startsWith(COMPONENT_SET_DIRECTORY)(file) ||
    Arr.some(FRAMEWORK_MODULE_PATTERNS, (pattern) => pattern.test(file)) ||
    Arr.some(published, (directory) => Str.startsWith(directory)(file))
      ? []
      : Arr.flatMap(sourceFile.statements, (statement) =>
          Arr.map(
            Arr.filter(
              exportedNames(statement),
              (name) =>
                !(declarations && namedByExport(sourceFile, statement, name))
            ),
            (name) => ({
              file,
              line:
                sourceFile.getLineAndCharacterOfPosition(
                  statement.getStart(sourceFile)
                ).line + 1,
              name,
            })
          )
        )
  );
  const names = HashSet.fromIterable(Arr.map(declared, ({ name }) => name));
  const mentions = Arr.reduce(
    Arr.flatMap(texts, (text) =>
      Arr.fromIterable(
        HashSet.fromIterable(
          Arr.filter(Str.split(text, WORD_BREAK_PATTERN), (word) =>
            HashSet.has(names, word)
          )
        )
      )
    ),
    HashMap.empty<string, number>(),
    (counts, name) =>
      HashMap.modifyAt(counts, name, (count) =>
        Option.some(Option.getOrElse(count, () => 0) + 1)
      )
  );
  return Arr.filterMap(declared, ({ file, line, name }) =>
    Option.exists(HashMap.get(mentions, name), (count) => count > 1)
      ? Result.failVoid
      : Result.succeed(
          `${file}:${line}: no other module names ${name}: remove its \`export\`, or delete the declaration when this module does not use it either (unused-export)`
        )
  );
}

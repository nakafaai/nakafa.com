import {
  Array as Arr,
  HashMap,
  HashSet,
  Option,
  Result,
  String as Str,
  Tuple,
} from "effect";
import {
  type Expression,
  isArrayLiteralExpression,
  isAsExpression,
  isCallExpression,
  isExportDeclaration,
  isIdentifier,
  isImportDeclaration,
  isNamedImports,
  isNoSubstitutionTemplateLiteral,
  isParenthesizedExpression,
  isPropertyAssignment,
  isSatisfiesExpression,
  isSpreadElement,
  isStringLiteral,
  isTemplateExpression,
  isVariableStatement,
  type Node,
  type SourceFile,
  SyntaxKind,
} from "tsrs/ast";
import { loadsExport, loadsImport } from "#scripts/check/kinds";
import { descendants } from "#scripts/check/source";

/** The loaders that take a route's namespace list as their second argument. */
const LIST_CALLS = HashSet.make("getRouteMessages", "pickRouteMessages");

/**
 * What one module does with messages: the modules it loads, the namespaces it reads, the lists it loads, whether it
 * draws use-intl's own provider, and the lines of its translators that name no namespace by a literal. A list stays a syntax node, which no Schema describes as data.
 */
export interface Facts {
  readonly bare: boolean;
  readonly imports: readonly string[];
  readonly keys: readonly string[];
  readonly lists: readonly Expression[];
  readonly provides: boolean;
  readonly reads: readonly string[];
  readonly sourceFile: SourceFile;
  readonly standalone: boolean;
  readonly unnamed: readonly number[];
}

/** The repository path a specifier names from `file`, before its extension: the app alias, a package, or a relative path. */
function specifierBase(file: string, specifier: string) {
  if (Str.startsWith("@/")(specifier)) {
    return Option.some(`apps/www/src/${specifier.slice(2)}`);
  }
  if (Str.startsWith("@repo/")(specifier)) {
    return Option.some(`packages/${specifier.slice("@repo/".length)}`);
  }
  if (!Str.startsWith(".")(specifier)) {
    return Option.none();
  }
  const segments = Arr.appendAll(
    Arr.dropRight(Str.split(file, "/"), 1),
    Str.split(specifier, "/")
  );
  return Option.some(
    Arr.join(
      Arr.reduce(segments, Arr.empty<string>(), (path, segment) => {
        if (segment === "..") {
          return Arr.dropRight(path, 1);
        }
        return segment === "." ? path : Arr.append(path, segment);
      }),
      "/"
    )
  );
}

/** The authored module a specifier names from `file`, when one of `modules` answers it. */
function resolveModule(
  modules: (file: string) => boolean,
  file: string,
  specifier: string
) {
  return Option.flatMap(specifierBase(file, specifier), (base) =>
    Arr.findFirst([`${base}.ts`, `${base}.tsx`, base], modules)
  );
}

/** The literal text of a node that can spell a message key, or the static head of a template. */
function keyText(node: Node) {
  if (isStringLiteral(node) || isNoSubstitutionTemplateLiteral(node)) {
    return Option.some(node.text);
  }
  return isTemplateExpression(node)
    ? Option.some(node.head.text)
    : Option.none();
}

/** The specifiers of a module's value imports, re-exports and on-demand imports: a type-only one loads nothing. */
function loadedSpecifiers(sourceFile: SourceFile, nodes: readonly Node[]) {
  const statements = Arr.filterMap(sourceFile.statements, (statement) => {
    if (isImportDeclaration(statement) && loadsImport(statement)) {
      return Result.succeed(statement.moduleSpecifier);
    }
    return isExportDeclaration(statement) &&
      loadsExport(statement) &&
      statement.moduleSpecifier !== undefined
      ? Result.succeed(statement.moduleSpecifier)
      : Result.failVoid;
  });
  const onDemand = Arr.flatMap(nodes, (node) =>
    isCallExpression(node) && node.expression.kind === SyntaxKind.ImportKeyword
      ? Arr.take(node.arguments, 1)
      : []
  );
  return Arr.filterMap(Arr.appendAll(statements, onDemand), (specifier) =>
    isStringLiteral(specifier)
      ? Result.succeed(specifier.text)
      : Result.failVoid
  );
}

/** Whether a node calls the function of that name, as `useTranslations("Common")` does. */
const calls = (node: Node, name: string) =>
  isCallExpression(node) &&
  isIdentifier(node.expression) &&
  node.expression.text === name;

/** The first argument of a call, or none for any other node. */
const firstArgument = (node: Node) =>
  isCallExpression(node) ? Arr.head(node.arguments) : Option.none();

/** What one module does with messages, read from its syntax. */
export function moduleFacts(
  file: string,
  sourceFile: SourceFile,
  modules: HashSet.HashSet<string>,
  namespaces: HashSet.HashSet<string>
): Facts {
  const nodes = descendants(sourceFile);
  const translators = Arr.filter(nodes, (node) =>
    calls(node, "useTranslations")
  );
  return {
    bare: Arr.some(translators, (node) => Option.isNone(firstArgument(node))),
    imports: Arr.filterMap(loadedSpecifiers(sourceFile, nodes), (specifier) =>
      Option.match(
        resolveModule((path) => HashSet.has(modules, path), file, specifier),
        { onNone: () => Result.failVoid, onSome: Result.succeed }
      )
    ),
    keys: Arr.filterMap(nodes, (node) =>
      Option.match(
        Option.filter(
          Option.map(keyText(node), (text) => Str.split(text, ".")),
          (parts) => parts.length > 1 && HashSet.has(namespaces, parts[0])
        ),
        {
          onNone: () => Result.failVoid,
          onSome: (parts) => Result.succeed(parts[0]),
        }
      )
    ),
    lists: Arr.flatMap(nodes, (node) => {
      if (
        isPropertyAssignment(node) &&
        isIdentifier(node.name) &&
        node.name.text === "namespaces"
      ) {
        return [node.initializer];
      }
      return isCallExpression(node) &&
        isIdentifier(node.expression) &&
        HashSet.has(LIST_CALLS, node.expression.text)
        ? Arr.drop(node.arguments, 1)
        : [];
    }),
    provides: Arr.some(
      sourceFile.statements,
      (statement) =>
        isImportDeclaration(statement) &&
        isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === "use-intl" &&
        Option.exists(
          Option.filter(
            Option.fromNullishOr(statement.importClause?.namedBindings),
            isNamedImports
          ),
          (named) =>
            Arr.some(
              named.elements,
              (element) =>
                (element.propertyName ?? element.name).text === "IntlProvider"
            )
        )
    ),
    reads: Arr.filterMap(translators, (node) =>
      Option.match(Option.filter(firstArgument(node), isStringLiteral), {
        onNone: () => Result.failVoid,
        onSome: (literal) => Result.succeed(literal.text),
      })
    ),
    sourceFile,
    standalone: Arr.some(nodes, (node) =>
      calls(node, "readStandaloneMessages")
    ),
    unnamed: Arr.filterMap(translators, (node) =>
      Option.exists(
        firstArgument(node),
        (argument) => !isStringLiteral(argument)
      )
        ? Result.succeed(
            sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
              .line + 1
          )
        : Result.failVoid
    ),
  };
}

/** The initializer a module binds to `name`: its own declaration, or the export of the module it imports it from. */
function boundValue(
  facts: HashMap.HashMap<string, Facts>,
  file: string,
  name: string
): Option.Option<readonly [string, Expression]> {
  return Option.flatMap(HashMap.get(facts, file), ({ sourceFile }) => {
    const declared = Arr.findFirst(
      Arr.flatMap(sourceFile.statements, (statement) =>
        isVariableStatement(statement)
          ? statement.declarationList.declarations
          : []
      ),
      (declaration) =>
        isIdentifier(declaration.name) && declaration.name.text === name
    );
    if (Option.isSome(declared)) {
      return Option.map(
        Option.fromNullishOr(declared.value.initializer),
        (initializer) => Tuple.make(file, initializer)
      );
    }
    return Arr.findFirst(sourceFile.statements, (statement) => {
      if (
        !(
          isImportDeclaration(statement) &&
          isStringLiteral(statement.moduleSpecifier)
        )
      ) {
        return Option.none();
      }
      const element = Option.filter(
        Option.fromNullishOr(statement.importClause?.namedBindings),
        isNamedImports
      ).pipe(
        Option.flatMap((named) =>
          Arr.findFirst(named.elements, (item) => item.name.text === name)
        )
      );
      const target = resolveModule(
        (path) => HashMap.has(facts, path),
        file,
        statement.moduleSpecifier.text
      );
      return Option.flatMap(Option.all([element, target]), ([item, module]) =>
        boundValue(facts, module, (item.propertyName ?? item.name).text)
      );
    });
  });
}

/** The namespaces a list names: literals, spreads and the constants they name, through `as const` and `satisfies`. */
export function listNames(
  facts: HashMap.HashMap<string, Facts>,
  file: string,
  node: Expression
): readonly string[] {
  if (
    isAsExpression(node) ||
    isSatisfiesExpression(node) ||
    isParenthesizedExpression(node)
  ) {
    return listNames(facts, file, node.expression);
  }
  if (isIdentifier(node)) {
    return Option.match(boundValue(facts, file, node.text), {
      onNone: () => [],
      onSome: ([target, initializer]) => listNames(facts, target, initializer),
    });
  }
  if (!isArrayLiteralExpression(node)) {
    return [];
  }
  return Arr.flatMap(node.elements, (element) => {
    if (isStringLiteral(element)) {
      return [element.text];
    }
    return isSpreadElement(element)
      ? listNames(facts, file, element.expression)
      : [];
  });
}

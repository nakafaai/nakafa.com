import { Array as Arr, Effect, Order, Result } from "effect";
import {
  type Expression,
  type Identifier,
  isBindingElement,
  isIdentifier,
  isVariableDeclaration,
  type Node,
} from "typescript/unstable/ast";
import { isConfiguration, TEST_PATTERN } from "#scripts/check/kinds";
import { classParts, classReferences } from "#scripts/check/positions";
import {
  isGenerated,
  type parseSources,
  type TestCompilerError,
} from "#scripts/check/source";

const FINDING_ORDER = Order.Struct({ file: Order.String, line: Order.Number });
const RULE =
  "write them inside cva(...) (one compoundVariants entry when several variants share them), inside cn(...), or in the className itself, or give the element a small component that owns them";

type Parsed = Effect.Success<ReturnType<typeof parseSources>>;
type Module = Parsed["modules"][number];

/**
 * Returns the values a declared name can be given: the initializer of its
 * variable, and for a name that a pattern takes out of a variable, also the
 * default the pattern writes for it, as `"flex"` in
 * `const { item = "flex" } = options`. A parameter, a function, and a class
 * give none, and so does a pattern that takes its names out of a parameter.
 */
function declaredValues(node: Node): readonly Expression[] {
  if (isVariableDeclaration(node)) {
    return Arr.fromNullishOr(node.initializer);
  }
  if (!isBindingElement(node)) {
    return [];
  }
  const taken = declaredValues(node.parent.parent);
  return Arr.isReadonlyArrayEmpty(taken)
    ? []
    : Arr.appendAll(taken, Arr.fromNullishOr(node.initializer));
}

/**
 * Follows names from class values to the variables that declare them, and on
 * through the names those variables read, so a chain of constants is followed
 * to its end. Returns each variable once, with the parts of its value.
 */
const follow = Effect.fnUntraced(function* (
  declare: Parsed["declare"],
  pending: readonly {
    readonly module: Module;
    readonly reference: Identifier;
  }[],
  seen: readonly string[]
): Effect.fn.Return<
  readonly {
    readonly module: Module;
    readonly name: string;
    readonly node: Node;
    readonly parts: readonly Node[];
  }[],
  TestCompilerError
> {
  if (Arr.isReadonlyArrayEmpty(pending)) {
    return [];
  }
  const nodes = yield* declare(Arr.map(pending, ({ reference }) => reference));
  const declared = Arr.filterMap(
    Arr.zip(pending, nodes),
    ([{ module, reference }, node]) => {
      if (node === undefined) {
        return Result.failVoid;
      }
      const values = declaredValues(node);
      return Arr.isReadonlyArrayEmpty(values)
        ? Result.failVoid
        : Result.succeed({
            key: `${module.file}:${node.pos}`,
            module,
            name: reference.text,
            node,
            parts: Arr.flatMap(values, classParts),
          });
    }
  );
  const fresh = Arr.filter(
    Arr.dedupeWith(declared, (left, right) => left.key === right.key),
    ({ key }) => !Arr.contains(seen, key)
  );
  const next = Arr.flatMap(fresh, ({ module, parts }) =>
    Arr.map(Arr.filter(parts, isIdentifier), (reference) => ({
      module,
      reference,
    }))
  );
  return Arr.appendAll(
    fresh,
    yield* follow(
      declare,
      next,
      Arr.appendAll(
        seen,
        Arr.map(fresh, ({ key }) => key)
      )
    )
  );
});

/**
 * Reports each variable that keeps class strings where the editor's Tailwind
 * language server cannot read them. A name read in a class position that the
 * compiler resolves, in its own module, to a variable whose value writes class
 * text is reported once, at the declaration: a string, a template, a
 * concatenation, a condition between strings, or an array or object that holds
 * them. A name destructured out of a variable is judged by the value it comes
 * from and by the default its pattern writes for it. A literal written in the class position, a `cn(...)` or `cva(...)`
 * result, a parameter, and an imported name are not reported, because the check
 * does not follow an import into the module that declares it.
 */
export const classFindings = Effect.fn("RepositoryPolicy.classFindings")(
  function* ({ declare, modules }: Parsed) {
    const judged = Arr.filter(
      modules,
      ({ file, sourceFile }) =>
        !(
          TEST_PATTERN.test(file) ||
          isConfiguration(file, sourceFile) ||
          isGenerated(sourceFile)
        )
    );
    const start = Arr.flatMap(judged, (module) =>
      Arr.map(classReferences(module.sourceFile), (reference) => ({
        module,
        reference,
      }))
    );
    const variables = yield* follow(declare, start, []);
    return Arr.map(
      Arr.sort(
        Arr.filterMap(variables, ({ module, name, node, parts }) =>
          // A part that is not an identifier is class text written there.
          Arr.some(parts, (part) => !isIdentifier(part))
            ? Result.succeed({
                file: module.file,
                line:
                  module.sourceFile.getLineAndCharacterOfPosition(
                    node.getStart(module.sourceFile)
                  ).line + 1,
                name,
              })
            : Result.failVoid
        ),
        FINDING_ORDER
      ),
      ({ file, line, name }) =>
        `${file}:${line}: ${name} keeps class strings in a constant, where the Tailwind language server cannot read them: ${RULE}.`
    );
  }
);

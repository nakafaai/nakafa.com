import { Array as Arr, Effect, Order, Result } from "effect";
import {
  type Identifier,
  isIdentifier,
  type Node,
} from "typescript/unstable/ast";
import { isConfiguration, TEST_PATTERN } from "#scripts/check/kinds";
import { classParts, classReferences } from "#scripts/check/positions";
import {
  isGenerated,
  type parseSources,
  type TestCompilerError,
} from "#scripts/check/source";
import { isVariable, variableValues } from "#scripts/check/variables";

const FINDING_ORDER = Order.Struct({ file: Order.String, line: Order.Number });
const RULE =
  "write them inside cva(...) (one compoundVariants entry when several variants share them), inside cn(...), or in the className itself, or give the element a small component that owns them";

type Parsed = Effect.Success<ReturnType<typeof parseSources>>;
type Module = Parsed["modules"][number];

/**
 * Follows names from class values to the variables that declare them, and on
 * through the names those variables read, so a chain of constants is followed
 * to its end. Returns each variable once, with the parts of every value its
 * module gives it.
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
    ([{ module, reference }, node]) =>
      node !== undefined && isVariable(node)
        ? Result.succeed({
            key: `${module.file}:${node.pos}`,
            module,
            name: reference.text,
            node,
          })
        : Result.failVoid
  );
  const fresh = Arr.filter(
    Arr.dedupeWith(declared, (left, right) => left.key === right.key),
    ({ key }) => !Arr.contains(seen, key)
  );
  const given = yield* variableValues(declare, fresh);
  const found = Arr.zipWith(fresh, given, (variable, values) => ({
    ...variable,
    parts: Arr.flatMap(values, classParts),
  }));
  const next = Arr.flatMap(found, ({ module, parts }) =>
    Arr.map(Arr.filter(parts, isIdentifier), (reference) => ({
      module,
      reference,
    }))
  );
  return Arr.appendAll(
    found,
    yield* follow(
      declare,
      next,
      Arr.appendAll(
        seen,
        Arr.map(found, ({ key }) => key)
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
 * from and by the default its pattern writes for it, and any variable is judged
 * by each later assignment that writes it, as a name, in a destructuring
 * pattern, or at the start of a member, while a loop head assigns nothing. A
 * literal written in the class position, a `cn(...)` or `cva(...)` result, a
 * parameter, and an imported name are not reported, because the check does not
 * follow an import into the module that declares it.
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

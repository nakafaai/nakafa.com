import type { LeafPath } from "@repo/backend/scripts/refs/paths";
import { Array as Arr, Option, Order, Record } from "effect";

type Leaf = typeof LeafPath.Type;

/** The child groups of the leaves below one depth, sorted by segment as Confect sorts them. */
const childGroups = (leaves: readonly Leaf[], depth: number) => {
  const bySegment = Order.mapInput(
    Order.String,
    (entry: readonly [string, readonly Leaf[]]) => entry[0]
  );
  return Arr.sort(
    Record.toEntries(Arr.groupBy(leaves, (leaf) => leaf.segments[depth])),
    bySegment
  );
};

/** The leaf that a group at `depth` is itself, and the child groups of the leaves below it. */
const splitGroup = (leaves: readonly Leaf[], depth: number) => {
  const deeper = Arr.filter(leaves, (leaf) => leaf.segments.length > depth + 1);
  return {
    children: childGroups(deeper, depth + 1),
    leaf: Arr.findFirst(leaves, (leaf) => leaf.segments.length === depth + 1),
  };
};

/** The `GroupSpec` type that Confect writes for one group and its children. */
const groupType = (
  segment: string,
  leaves: readonly Leaf[],
  depth: number
): string => {
  const { children, leaf } = splitGroup(leaves, depth);
  const childTypes = Arr.join(
    Arr.map(
      children,
      ([childSegment, childLeaves]) =>
        `GroupSpec.NamedAt<${groupType(childSegment, childLeaves, depth + 1)}, "${childSegment}">`
    ),
    " | "
  );
  return Option.match(leaf, {
    onNone: () =>
      `GroupSpec.GroupSpec<"Convex", "${segment}", never, ${childTypes}>`,
    onSome: (found) =>
      children.length === 0
        ? `typeof ${found.localName}`
        : `GroupSpec.AddGroups<typeof ${found.localName}, ${childTypes}>`,
  });
};

/**
 * The group expression that Confect writes for one group and its children: the
 * leaf that the group is, or an unnamed group, with each child named by its key.
 */
const assemblyOf = (leaves: readonly Leaf[], depth: number): string => {
  const { children, leaf } = splitGroup(leaves, depth);
  const base = Option.match(leaf, {
    onNone: () => "GroupSpec.make()",
    onSome: (found) => found.localName,
  });
  if (children.length === 0) {
    return base;
  }
  const entries = Arr.map(
    children,
    ([childSegment, childLeaves]) =>
      `["${childSegment}"]: ${assemblyOf(childLeaves, depth + 1)}`
  );
  return `GroupSpec.addGroupsAt(${base}, { ${Arr.join(entries, ", ")} })`;
};

/**
 * Writes the source of one domain's refs module. It declares the same spec
 * type and assembly that Confect writes for the spec, restricted to the leaves
 * given, so the refs keep the Convex function names of the full spec.
 */
export const renderDomainModule = (
  domain: string,
  leaves: Arr.NonEmptyReadonlyArray<Leaf>
): string => {
  const imports = Arr.sort(
    leaves,
    Order.mapInput(Order.String, (leaf: Leaf) => leaf.localName)
  );
  return Arr.join(
    [
      `import { GroupSpec, Refs, Spec } from "@confect/core";`,
      ...Arr.map(
        imports,
        (leaf) =>
          `import ${leaf.localName} from "../../${leaf.specifier.slice("../".length)}";`
      ),
      "",
      "const spec: Spec.Spec<{",
      `  readonly ${domain}: GroupSpec.NamedAt<${groupType(domain, leaves, 0)}, "${domain}">;`,
      `}> = Spec.fromGroups({ ["${domain}"]: ${assemblyOf(leaves, 0)} }) as typeof spec;`,
      "",
      "const refs: Refs.FromSpec<typeof spec> = Refs.make(spec);",
      "",
      `export default refs.public.${domain};`,
      "",
    ],
    "\n"
  );
};

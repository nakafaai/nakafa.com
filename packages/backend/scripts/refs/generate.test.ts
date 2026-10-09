import { type GroupSpec, Spec } from "@confect/core";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { describe, expect, expectTypeOf, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import access from "@repo/backend/confect/_generated/refs/access";
import auth from "@repo/backend/confect/_generated/refs/auth";
import chats from "@repo/backend/confect/_generated/refs/chats";
import classes from "@repo/backend/confect/_generated/refs/classes";
import comments from "@repo/backend/confect/_generated/refs/comments";
import consents from "@repo/backend/confect/_generated/refs/consents";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import contents from "@repo/backend/confect/_generated/refs/contents";
import customers from "@repo/backend/confect/_generated/refs/customers";
import journal from "@repo/backend/confect/_generated/refs/journal";
import learningPreferences from "@repo/backend/confect/_generated/refs/learningPreferences";
import nina from "@repo/backend/confect/_generated/refs/nina";
import onboarding from "@repo/backend/confect/_generated/refs/onboarding";
import schools from "@repo/backend/confect/_generated/refs/schools";
import subscriptions from "@repo/backend/confect/_generated/refs/subscriptions";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import users from "@repo/backend/confect/_generated/refs/users";
import spec from "@repo/backend/confect/_generated/spec";
import { generateRefs } from "@repo/backend/scripts/refs/generate";
import {
  Array as Arr,
  Effect,
  FileSystem,
  Option,
  Order,
  Path,
  Predicate,
  Record,
  Schema,
} from "effect";

/** The backend package root, found from this test file's folder. */
const backendRoot = Effect.gen(function* () {
  const path = yield* Path.Path;
  const folder = yield* path.fromFileUrl(new URL("./", import.meta.url));
  return path.resolve(folder, "../..");
});

/** One function of the full spec, with the group path and visibility it declares. */
const SpecFunction = Schema.Struct({
  name: Schema.String,
  path: Schema.Array(Schema.String),
  visibility: Schema.Literals(["public", "internal"]),
});

/** Every function of the spec's groups, found through the Confect API. */
const specFunctions = (
  groups: Record.ReadonlyRecord<string, GroupSpec.AnyWithProps>,
  prefix: readonly string[]
): readonly (typeof SpecFunction.Type)[] =>
  Arr.flatMap(Record.toEntries(groups), ([segment, group]) => {
    const path = [...prefix, segment];
    return [
      ...Arr.map(Record.toEntries(group.functions), ([name, fn]) => ({
        name,
        path,
        visibility: fn.functionVisibility,
      })),
      ...specFunctions(group.groups, path),
    ];
  });

/** The value that a path reaches, when every segment is a property of the value before it. */
const valueAt = (
  root: unknown,
  path: readonly string[]
): Option.Option<unknown> =>
  Arr.reduce(path, Option.some(root), (node, segment) =>
    Option.flatMap(node, (value) =>
      Predicate.hasProperty(value, segment)
        ? Option.some(value[segment])
        : Option.none()
    )
  );

/** The Convex function name of a ref, when the value is a ref. */
const convexNameOf = (value: unknown): Option.Option<string> =>
  Predicate.hasProperty(value, "convexFunctionName") &&
  Predicate.isString(value.convexFunctionName)
    ? Option.some(value.convexFunctionName)
    : Option.none();

/** The per-domain refs modules, keyed by domain. */
const domainModules = {
  access,
  auth,
  chats,
  classes,
  comments,
  consents,
  contentRelease,
  contents,
  customers,
  journal,
  learningPreferences,
  nina,
  onboarding,
  schools,
  subscriptions,
  tenancy,
  tryouts,
  users,
};
const modules: Record.ReadonlyRecord<string, unknown> = domainModules;

/** The spec's functions, reached from the full spec's top-level groups. */
const allFunctions = specFunctions(Spec.groups(spec), []);

describe("generateRefs", () => {
  it.live(
    "writes the public domains and deletes the module of a retired one",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* backendRoot;
        const directory = yield* fs.makeTempDirectoryScoped({
          prefix: "refs-generate-test-",
        });
        const outputDirectory = path.join(directory, "refs");
        yield* fs.makeDirectory(outputDirectory, { recursive: true });
        yield* fs.writeFileString(
          path.join(outputDirectory, "retired.ts"),
          "export {};\n"
        );

        const expected = yield* generateRefs({
          backendRoot: root,
          outputDirectory,
          specPath: path.join(root, "confect", "_generated", "spec.ts"),
        });

        expect(expected).toContain("access.ts");
        expect(expected).not.toContain("storage.ts");
        expect(
          Arr.sort(yield* fs.readDirectory(outputDirectory), Order.String)
        ).toEqual(Arr.sort(expected, Order.String));
      }).pipe(Effect.provide(nodeServicesLayer)),
    60_000
  );

  it.live(
    "fails with both group paths, before loading any leaf, when a leaf file and its nesting differ",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* backendRoot;
        const directory = yield* fs.makeTempDirectoryScoped({
          prefix: "refs-mismatch-test-",
        });
        const specPath = path.join(directory, "_generated", "spec.ts");
        yield* fs.makeDirectory(path.dirname(specPath), { recursive: true });
        yield* fs.writeFileString(
          specPath,
          `import { GroupSpec, Spec } from "@confect/core";
import nina_turns from "../nina/turns.spec";
const spec: Spec.Spec<{}> = Spec.make().addAt("nina", GroupSpec.makeAt("nina").addGroupAt("other", nina_turns));
export default spec;
`
        );

        expect(
          yield* generateRefs({
            backendRoot: root,
            outputDirectory: path.join(directory, "refs"),
            specPath,
          }).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "RefsNestingError",
          derivedPath: "nina.turns",
          nestedPath: "nina.other",
          specifier: "../nina/turns.spec",
        });
      }).pipe(Effect.provide(nodeServicesLayer)),
    60_000
  );

  it.live(
    "regenerates the committed refs byte for byte",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* backendRoot;
        const committed = path.join(root, "confect", "_generated", "refs");
        const directory = yield* fs.makeTempDirectoryScoped({
          prefix: "refs-parity-test-",
        });
        yield* generateRefs({
          backendRoot: root,
          outputDirectory: directory,
          specPath: path.join(root, "confect", "_generated", "spec.ts"),
        });

        const names = Arr.sort(
          yield* fs.readDirectory(committed),
          Order.String
        );
        expect(
          Arr.sort(yield* fs.readDirectory(directory), Order.String)
        ).toEqual(names);
        yield* Effect.forEach(
          names,
          (name) =>
            Effect.gen(function* () {
              const generated = yield* fs.readFileString(
                path.join(directory, name)
              );
              const committedText = yield* fs.readFileString(
                path.join(committed, name)
              );
              expect(generated).toBe(committedText);
            }),
          { discard: true }
        );
      }).pipe(Effect.provide(nodeServicesLayer)),
    60_000
  );

  it.live(
    "reaches every public function in its domain module under the Convex name of the full spec",
    () =>
      Effect.gen(function* () {
        const publicFunctions = Arr.filter(
          allFunctions,
          (fn) => fn.visibility === "public"
        );
        expect(publicFunctions.length).toBeGreaterThan(0);
        for (const fn of publicFunctions) {
          const expected = `${Arr.join(fn.path, "/")}:${fn.name}`;
          const inModule = Option.flatMap(
            Record.get(modules, fn.path[0]),
            (module) => valueAt(module, [...Arr.drop(fn.path, 1), fn.name])
          );
          const inFullSpec = valueAt(refs.public, [...fn.path, fn.name]);
          expect(
            Option.getOrUndefined(Option.flatMap(inModule, convexNameOf))
          ).toBe(expected);
          expect(
            Option.getOrUndefined(Option.flatMap(inFullSpec, convexNameOf))
          ).toBe(expected);
        }
      })
  );

  it.live(
    "holds no leaf without a public function, and no module for a domain without one",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* backendRoot;
        const leaves = Record.toEntries(
          Arr.groupBy(allFunctions, (fn) => Arr.join(fn.path, "/"))
        );
        for (const [, functionsOfLeaf] of leaves) {
          const [leaf] = functionsOfLeaf;
          const isPublic = Arr.some(
            functionsOfLeaf,
            (fn) => fn.visibility === "public"
          );
          const reached = Option.flatMap(
            Record.get(modules, leaf.path[0]),
            (module) => valueAt(module, Arr.drop(leaf.path, 1))
          );
          if (!isPublic) {
            expect(Option.isNone(reached)).toBe(true);
          }
        }

        const publicDomains = Record.keys(
          Arr.groupBy(
            Arr.filter(allFunctions, (fn) => fn.visibility === "public"),
            (fn) => fn.path[0]
          )
        );
        const modulesOnDisk = yield* fs.readDirectory(
          path.join(root, "confect", "_generated", "refs")
        );
        expect(Arr.sort(modulesOnDisk, Order.String)).toEqual(
          Arr.sort(
            Arr.map(publicDomains, (domain) => `${domain}.ts`),
            Order.String
          )
        );
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  it("types the domain modules as the public refs of the full spec", () => {
    expectTypeOf(domainModules).toEqualTypeOf<typeof refs.public>();
  });
});

import { type GroupSpec, Spec } from "@confect/core";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { describe, expect, expectTypeOf, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import access from "@repo/backend/confect/_generated/refs/access";
import analyticsInternal from "@repo/backend/confect/_generated/refs/analytics.server";
import auth from "@repo/backend/confect/_generated/refs/auth";
import authInternal from "@repo/backend/confect/_generated/refs/auth.server";
import billing from "@repo/backend/confect/_generated/refs/billing";
import billingInternal from "@repo/backend/confect/_generated/refs/billing.server";
import chats from "@repo/backend/confect/_generated/refs/chats";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import classroomInternal from "@repo/backend/confect/_generated/refs/classroom.server";
import comments from "@repo/backend/confect/_generated/refs/comments";
import connectors from "@repo/backend/confect/_generated/refs/connectors";
import connectorsInternal from "@repo/backend/confect/_generated/refs/connectors.server";
import consents from "@repo/backend/confect/_generated/refs/consents";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import contentReleaseInternal from "@repo/backend/confect/_generated/refs/contentRelease.server";
import contents from "@repo/backend/confect/_generated/refs/contents";
import contentsInternal from "@repo/backend/confect/_generated/refs/contents.server";
import creditsInternal from "@repo/backend/confect/_generated/refs/credits.server";
import editor from "@repo/backend/confect/_generated/refs/editor";
import editorInternal from "@repo/backend/confect/_generated/refs/editor.server";
import emailsInternal from "@repo/backend/confect/_generated/refs/emails.server";
import exams from "@repo/backend/confect/_generated/refs/exams";
import examsInternal from "@repo/backend/confect/_generated/refs/exams.server";
import guardians from "@repo/backend/confect/_generated/refs/guardians";
import guardiansInternal from "@repo/backend/confect/_generated/refs/guardians.server";
import identity from "@repo/backend/confect/_generated/refs/identity";
import identityInternal from "@repo/backend/confect/_generated/refs/identity.server";
import integrations from "@repo/backend/confect/_generated/refs/integrations";
import integrationsInternal from "@repo/backend/confect/_generated/refs/integrations.server";
import journal from "@repo/backend/confect/_generated/refs/journal";
import learningPreferences from "@repo/backend/confect/_generated/refs/learningPreferences";
import nina from "@repo/backend/confect/_generated/refs/nina";
import ninaInternal from "@repo/backend/confect/_generated/refs/nina.server";
import notifications from "@repo/backend/confect/_generated/refs/notifications";
import notificationsInternal from "@repo/backend/confect/_generated/refs/notifications.server";
import onboarding from "@repo/backend/confect/_generated/refs/onboarding";
import operators from "@repo/backend/confect/_generated/refs/operators";
import operatorsInternal from "@repo/backend/confect/_generated/refs/operators.server";
import posts from "@repo/backend/confect/_generated/refs/posts";
import postsInternal from "@repo/backend/confect/_generated/refs/posts.server";
import privacyInternal from "@repo/backend/confect/_generated/refs/privacy.server";
import records from "@repo/backend/confect/_generated/refs/records";
import recordsInternal from "@repo/backend/confect/_generated/refs/records.server";
import roster from "@repo/backend/confect/_generated/refs/roster";
import routesInternal from "@repo/backend/confect/_generated/refs/routes.server";
import storageInternal from "@repo/backend/confect/_generated/refs/storage.server";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import tenancyInternal from "@repo/backend/confect/_generated/refs/tenancy.server";
import triggersInternal from "@repo/backend/confect/_generated/refs/triggers.server";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import tryoutsInternal from "@repo/backend/confect/_generated/refs/tryouts.server";
import users from "@repo/backend/confect/_generated/refs/users";
import usersInternal from "@repo/backend/confect/_generated/refs/users.server";
import vaultInternal from "@repo/backend/confect/_generated/refs/vault.server";
import spec from "@repo/backend/confect/_generated/spec";
import { generateRefs } from "@repo/backend/scripts/refs/generate";
import type { FunctionVisibility } from "convex/server";
import {
  Array as Arr,
  Effect,
  FileSystem,
  Option,
  Order,
  Path,
  Predicate,
  Record,
  Result,
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
  billing,
  chats,
  classroom,
  comments,
  connectors,
  consents,
  contentRelease,
  contents,
  editor,
  exams,
  guardians,
  identity,
  integrations,
  journal,
  learningPreferences,
  nina,
  notifications,
  onboarding,
  operators,
  posts,
  records,
  roster,
  tenancy,
  tryouts,
  users,
};
/** The per-domain internal refs modules, which only the server reads, keyed by domain. */
const internalModules = {
  analytics: analyticsInternal,
  auth: authInternal,
  billing: billingInternal,
  classroom: classroomInternal,
  connectors: connectorsInternal,
  contentRelease: contentReleaseInternal,
  contents: contentsInternal,
  credits: creditsInternal,
  editor: editorInternal,
  emails: emailsInternal,
  exams: examsInternal,
  guardians: guardiansInternal,
  identity: identityInternal,
  integrations: integrationsInternal,
  nina: ninaInternal,
  notifications: notificationsInternal,
  operators: operatorsInternal,
  posts: postsInternal,
  privacy: privacyInternal,
  records: recordsInternal,
  routes: routesInternal,
  storage: storageInternal,
  tenancy: tenancyInternal,
  triggers: triggersInternal,
  tryouts: tryoutsInternal,
  users: usersInternal,
  vault: vaultInternal,
};

/** Each visibility's domain modules, as the generator writes them. */
const modulesOf: {
  readonly [Visibility in FunctionVisibility]: Record.ReadonlyRecord<
    string,
    unknown
  >;
} = { internal: internalModules, public: domainModules };

/** The file of a domain's module of each visibility. */
const fileOf = (domain: string, visibility: FunctionVisibility) =>
  visibility === "public" ? `${domain}.ts` : `${domain}.server.ts`;

/** The spec's functions, reached from the full spec's top-level groups. */
const allFunctions = specFunctions(Spec.groups(spec), []);

describe("generateRefs", () => {
  it.live(
    "writes each domain's public and internal modules and deletes the module of a retired one",
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
        expect(expected).not.toContain("access.server.ts");
        expect(expected).toContain("storage.server.ts");
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
const spec: Spec.Spec<{}> = Spec.fromGroups({ ["nina"]: GroupSpec.addGroupsAt(GroupSpec.make(), { ["other"]: nina_turns }) });
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
    "reaches every function in its domain module of its visibility under the Convex name of the full spec",
    () =>
      Effect.gen(function* () {
        expect(
          Arr.filter(allFunctions, (fn) => fn.visibility === "internal").length
        ).toBeGreaterThan(0);
        for (const fn of allFunctions) {
          const expected = `${Arr.join(fn.path, "/")}:${fn.name}`;
          const inModule = Option.flatMap(
            Record.get(modulesOf[fn.visibility], fn.path[0]),
            (module) => valueAt(module, [...Arr.drop(fn.path, 1), fn.name])
          );
          const inFullSpec = valueAt(refs[fn.visibility], [
            ...fn.path,
            fn.name,
          ]);
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
    "holds no leaf without a function of the module's visibility unless a leaf of it sits deeper, and no module for a domain without one",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* backendRoot;
        const leaves = Record.toEntries(
          Arr.groupBy(allFunctions, (fn) => Arr.join(fn.path, "/"))
        );
        for (const [visibility, modules] of Record.toEntries(modulesOf)) {
          const holders = Arr.filterMap(leaves, ([key, functionsOfLeaf]) =>
            Arr.some(functionsOfLeaf, (fn) => fn.visibility === visibility)
              ? Result.succeed(key)
              : Result.failVoid
          );
          for (const [key, functionsOfLeaf] of leaves) {
            const [leaf] = functionsOfLeaf;
            // Refs reach a group that a deeper leaf of the visibility sits in, as Confect nests them.
            const needed = Arr.some(
              holders,
              (holder) => holder === key || holder.startsWith(`${key}/`)
            );
            const reached = Option.flatMap(
              Record.get(modules, leaf.path[0]),
              (module) => valueAt(module, Arr.drop(leaf.path, 1))
            );
            if (!needed) {
              expect(Option.isNone(reached)).toBe(true);
            }
          }
        }

        const domainsOf = (visibility: FunctionVisibility) =>
          Arr.map(
            Record.keys(
              Arr.groupBy(
                Arr.filter(allFunctions, (fn) => fn.visibility === visibility),
                (fn) => fn.path[0]
              )
            ),
            (domain) => fileOf(domain, visibility)
          );
        const modulesOnDisk = yield* fs.readDirectory(
          path.join(root, "confect", "_generated", "refs")
        );
        expect(Arr.sort(modulesOnDisk, Order.String)).toEqual(
          Arr.sort(
            [...domainsOf("public"), ...domainsOf("internal")],
            Order.String
          )
        );
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  it("types the domain modules as the public and internal refs of the full spec", () => {
    expectTypeOf(domainModules).toEqualTypeOf<typeof refs.public>();
    expectTypeOf(internalModules).toEqualTypeOf<typeof refs.internal>();
  });
});

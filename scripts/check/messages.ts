import {
  Array as Arr,
  Effect,
  FileSystem,
  HashMap,
  HashSet,
  MutableHashMap,
  MutableList,
  Option,
  Order,
  Path,
  Record as Rec,
  Result,
  Schema,
  String as Str,
  Tuple,
} from "effect";
import { parseSources, type RepositorySource } from "#scripts/check/source";
import { type Facts, listNames, moduleFacts } from "#scripts/check/translators";

const ROUTES_FOLDER = "apps/www/src/routes/";
/** The file routes of the app, each a page or a layout that renders a module graph of its own. */
const ROUTE_PATTERN = /^apps\/www\/src\/routes\/.+\.tsx$/u;
/** The modules that a route can render: the app's own and every workspace package's. */
const MODULE_PATTERN = /^(?:apps\/www\/src|packages\/[^/]+)\/.+\.tsx?$/u;
/** Declarations, tests and Playwright specs, which no route renders. */
const NON_RUNTIME_PATTERN = /\.(?:d|test|browser)\.tsx?$/u;
/** The English dictionaries, whose top-level keys name every namespace: the app's and the standalone pages'. */
const APP_DICTIONARY = "packages/internationalization/dictionaries/en.json";
const STANDALONE_DICTIONARY =
  "packages/internationalization/dictionaries/standalone/en.json";
/** A segment separator in a flat route file name: a dot outside the brackets that escape one. */
const FLAT_SEPARATOR = /\.(?![^[]*\])/u;
const RULE =
  "add the namespace to the list this route loads, or render the module under a route that loads it";
/** The one module that draws use-intl's provider, with the report that fails a strict build on a missing message. */
const PROVIDER_MODULE = "apps/www/src/lib/i18n/provider.tsx";
const PROVIDER_RULE =
  "draw a route's messages with MessagesProvider from @/lib/i18n/provider, whose report fails a strict build on a missing message, instead of use-intl's IntlProvider";
const UNNAMED_RULE =
  "name the namespace of useTranslations with a string literal, so each route's messages can be checked";

const Dictionary = Schema.fromJsonString(
  Schema.Record(Schema.String, Schema.Unknown)
);

/**
 * One route's walk: the namespaces its modules load, and each namespace they read with the nearest module that reads
 * it. A translator without a namespace reads the keys that the walked modules spell, as `"Marketing.pricing"` does. A
 * module that reads the standalone dictionaries renders their namespaces through its own provider.
 */
function walk(
  facts: HashMap.HashMap<string, Facts>,
  standalone: HashSet.HashSet<string>,
  route: string
) {
  const pending = MutableList.make<string>();
  MutableList.append(pending, route);
  const seen = MutableHashMap.make([route, true] as const);
  const loads = MutableHashMap.empty<string, true>();
  const readers = MutableHashMap.empty<string, string>();
  const keys = MutableList.make<string>();
  const read = (name: string, file: string) => {
    if (!MutableHashMap.has(readers, name)) {
      MutableHashMap.set(readers, name, file);
    }
  };
  let bare = Option.none<string>();
  for (
    let file = MutableList.take(pending);
    file !== MutableList.Empty;
    file = MutableList.take(pending)
  ) {
    const module = HashMap.getUnsafe(facts, file);
    for (const name of Arr.flatMap(module.lists, (list) =>
      listNames(facts, file, list)
    )) {
      MutableHashMap.set(loads, name, true);
    }
    for (const name of module.reads) {
      if (!(module.standalone && HashSet.has(standalone, name))) {
        read(name, file);
      }
    }
    MutableList.appendAll(keys, module.keys);
    bare = module.bare && Option.isNone(bare) ? Option.some(file) : bare;
    for (const target of module.imports) {
      if (!(MutableHashMap.has(seen, target) || ROUTE_PATTERN.test(target))) {
        MutableHashMap.set(seen, target, true);
        MutableList.append(pending, target);
      }
    }
  }
  for (const reader of Option.toArray(bare)) {
    for (const name of MutableList.takeAll(keys)) {
      read(name, reader);
    }
  }
  return { loads: HashSet.fromIterable(MutableHashMap.keys(loads)), readers };
}

/** The layouts above a route, outermost first: the root, then each path prefix's own file or its folder's `route.tsx`. */
function layouts(routes: HashSet.HashSet<string>, route: string) {
  const segments = Arr.flatMap(
    Str.split(
      Str.replace(/\.tsx$/u, "")(route.slice(ROUTES_FOLDER.length)),
      "/"
    ),
    (segment) => Str.split(segment, FLAT_SEPARATOR)
  );
  const sizes = segments.length > 1 ? Arr.range(1, segments.length - 1) : [];
  const prefixes = Arr.flatMap(sizes, (size) => {
    const prefix = Arr.join(Arr.take(segments, size), "/");
    return [
      `${ROUTES_FOLDER}${prefix}.tsx`,
      `${ROUTES_FOLDER}${prefix}/route.tsx`,
    ];
  });
  return Arr.filter(
    Arr.prepend(prefixes, `${ROUTES_FOLDER}__root.tsx`),
    (file) => file !== route && HashSet.has(routes, file)
  );
}

/**
 * Reports each namespace that a route renders and that neither the route nor a layout above it loads, so use-intl
 * would print its key path, each module but the provider module that draws use-intl's own provider, and each
 * translator that names its namespace by anything but a literal. A route renders
 * what its module loads statically or on demand, other routes excepted; it loads what the lists among those modules
 * name. A module that reads the standalone dictionaries renders them through its own provider.
 */
export const messageFindings = Effect.fn("RepositoryPolicy.messageFindings")(
  function* (
    sources: readonly (typeof RepositorySource.Type)[],
    namespaces: readonly string[],
    standalone: readonly string[]
  ) {
    const scripts = Arr.filter(sources, ({ file }) =>
      MODULE_PATTERN.test(file)
    );
    if (!Arr.some(scripts, ({ file }) => ROUTE_PATTERN.test(file))) {
      return [];
    }
    const parsed = yield* parseSources(scripts);
    const files = HashSet.fromIterable(
      Arr.map(parsed.modules, ({ file }) => file)
    );
    const known = HashSet.fromIterable(Arr.appendAll(namespaces, standalone));
    const own = HashSet.fromIterable(standalone);
    const facts = HashMap.fromIterable(
      Arr.map(parsed.modules, ({ file, sourceFile }) =>
        Tuple.make(file, moduleFacts(file, sourceFile, files, known))
      )
    );
    const routes = HashSet.filter(files, (file) => ROUTE_PATTERN.test(file));
    const walks = HashMap.fromIterable(
      Arr.map(Arr.fromIterable(routes), (route) =>
        Tuple.make(route, walk(facts, own, route))
      )
    );
    const gaps = Arr.flatMap(
      Arr.sort(Str.Order)(Arr.fromIterable(routes)),
      (route) => {
        const loaded = Arr.reduce(
          layouts(routes, route),
          HashMap.getUnsafe(walks, route).loads,
          (have, layout) =>
            HashSet.union(have, HashMap.getUnsafe(walks, layout).loads)
        );
        return Arr.filterMap(
          Arr.sort(
            Arr.fromIterable(HashMap.getUnsafe(walks, route).readers),
            Order.mapInput(
              Str.Order,
              ([name]: readonly [string, string]) => name
            )
          ),
          ([name, reader]) =>
            HashSet.has(loaded, name)
              ? Result.failVoid
              : Result.succeed(
                  `${route}: ${reader} reads the ${name} messages, which neither this route nor a layout above it loads: ${RULE}.`
                )
        );
      }
    );
    const modules = Arr.sort(Str.Order)(Arr.fromIterable(HashMap.keys(facts)));
    const providers = Arr.filter(
      modules,
      (file) =>
        file !== PROVIDER_MODULE && HashMap.getUnsafe(facts, file).provides
    );
    const unnamed = Arr.flatMap(modules, (file) =>
      Arr.map(
        HashMap.getUnsafe(facts, file).unnamed,
        (line) => `${file}:${line}: ${UNNAMED_RULE}.`
      )
    );
    return Arr.flatten([
      gaps,
      Arr.map(providers, (file) => `${file}: ${PROVIDER_RULE}.`),
      unnamed,
    ]);
  },
  Effect.scoped
);

/**
 * Reads the app's and the packages' modules among `files`, with the namespaces of the English dictionaries, and
 * reports each route that renders a message it does not load. A repository without app routes has no findings.
 */
export const inspectMessageReach = Effect.fn(
  "RepositoryPolicy.inspectMessageReach"
)(function* (root: string, files: readonly string[]) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const relativePath = (file: string) =>
    Arr.join(Str.split(path.relative(root, file), path.sep), "/");
  const relative = Arr.map(files, relativePath);
  const modules = Arr.filter(
    files,
    (file) =>
      MODULE_PATTERN.test(relativePath(file)) &&
      !NON_RUNTIME_PATTERN.test(relativePath(file))
  );
  const sources = yield* Effect.forEach(modules, (file) =>
    Effect.map(
      fileSystem.readFileString(file),
      (sourceText): typeof RepositorySource.Type => ({
        file: relativePath(file),
        sourceText,
      })
    )
  );
  const namespaces = (file: string) =>
    Arr.contains(relative, file)
      ? Effect.map(
          Effect.flatMap(
            fileSystem.readFileString(path.join(root, file)),
            Schema.decodeUnknownEffect(Dictionary)
          ),
          Rec.keys
        )
      : Effect.succeed(Arr.empty<string>());
  return yield* messageFindings(
    sources,
    yield* namespaces(APP_DICTIONARY),
    yield* namespaces(STANDALONE_DICTIONARY)
  );
});

import { Array as Arr, HashSet, Option, Result, String as Str } from "effect";
import { COMPONENT_SET_DIRECTORIES } from "#scripts/check/exports";

const WORD_SEPARATOR_PATTERN = /[-_.\s]+/u;
const CAMEL_WORD_PATTERN = /(?<lower>[\p{Ll}\d])(?<upper>\p{Lu})/gu;
const ACRONYM_WORD_PATTERN = /(?<acronym>\p{Lu}+)(?<word>\p{Lu}\p{Ll})/gu;
const NUMBER_PATTERN = /^\d+$/u;
const EXTENSION_PATTERN = /(?<=[^.])\.[^.]+$/u;
/** An uppercase repository document, such as `README.md` or `CODE_OF_CONDUCT.md`. */
const DOCUMENT_PATTERN = /^[A-Z][A-Z\d]*(?:_[A-Z\d]+)*\.md$/u;
/**
 * The role a suffix gives a module, which names no capability of its own: a test, a server-only module, a Confect spec
 * or implementation, a configuration, a declaration, a browser suite, a fixture, a setup or generated output.
 */
const ROLE_SUFFIXES = HashSet.make(
  "browser",
  "build",
  "config",
  "d",
  "fixture",
  "functions",
  "gen",
  "impl",
  "public",
  "run",
  "server",
  "setup",
  "spec",
  "test"
);
/** The prefix of a module that only tests load, as `docs/adr/0021-rules.md` names it. */
const TEST_PREFIX = "test";
/** A module a tool writes beside hand-written ones, such as the router's `routeTree.gen.ts`. */
const GENERATED_FILE_PATTERN = /\.gen\.[cm]?tsx?$/u;
/** Folders a tool writes, whose names its tool gives. */
const GENERATED_FOLDERS = HashSet.make("_generated", "dist", "node_modules");
/** The folders whose entries are workspaces, each named after its package. */
const WORKSPACE_ROOTS = HashSet.make("apps", "packages");
/** Below an app, the folders whose paths are URLs: route files by the router's conventions, and public assets. */
const ADDRESS_FOLDERS = [["src", "routes"], ["public"]];
/** Below an app, type stubs of a platform's modules, named after the modules they describe. */
const STUB_FOLDER = "typings";
/** Folders below which every folder is a published content slug, such as a lesson's visuals. */
const CONTENT_ROOTS = [["packages", "design-system", "components", "contents"]];
/** The backend's folders whose names are the identities of its functions, tables and components. */
const BACKEND_ROOT = ["packages", "backend"];
const FUNCTION_ROOT = [...BACKEND_ROOT, "convex"];
const COMPONENT_ROOT = [...BACKEND_ROOT, "components"];
const SPEC_ROOT = [...BACKEND_ROOT, "confect"];
const TABLE_ROOT = [...SPEC_ROOT, "tables"];
/** A Confect function file, whose name and folders name the functions it declares or implements. */
const FUNCTION_FILE_PATTERN = /^(?:.+\.)?(?:spec|impl)(?:\.test)?\.ts$/u;
/** The implementation of one function of a spec beside it, named `<spec>.<function>.ts`. */
const SPLIT_FUNCTION_PATTERN = /^(?<spec>[^.]+)\.[^.]+(?:\.test)?\.ts$/u;
const SPEC_SUFFIX = ".spec.ts";

/** Returns the semantic words of one folder name or file name, without its role suffixes and numbers. */
function words(segment: string, isFile: boolean): readonly string[] {
  const name = isFile ? Str.replace(EXTENSION_PATTERN, "")(segment) : segment;
  const tokens = Arr.filter(
    Str.split(
      name
        .replace(ACRONYM_WORD_PATTERN, "$1 $2")
        .replace(CAMEL_WORD_PATTERN, "$1 $2"),
      WORD_SEPARATOR_PATTERN
    ),
    Str.isNonEmpty
  );
  const semantic = Arr.reverse(
    Arr.dropWhile(Arr.reverse(tokens), (word) =>
      HashSet.has(ROLE_SUFFIXES, Str.toLowerCase(word))
    )
  );
  // A module that only tests load is named `test.<name>.ts`, such as `test.setup.ts`, so its prefix is a role too.
  const named =
    semantic.length > 1 &&
    Option.exists(Arr.head(semantic), (word) => word === TEST_PREFIX)
      ? Arr.drop(semantic, 1)
      : semantic;
  return Arr.filter(named, (word) => !NUMBER_PATTERN.test(word));
}

/** The path up to and including the segment at `index`, which names the file or folder at fault once. */
function path(segments: readonly string[], index: number) {
  return Arr.join(Arr.take(segments, index + 1), "/");
}

/** Whether a path starts with an exact prefix of folders. */
function hasPrefix(segments: readonly string[], prefix: readonly string[]) {
  return (
    segments.length >= prefix.length &&
    Arr.every(prefix, (segment, index) => segments[index] === segment)
  );
}

/** A word and its plurals, compared without case. */
function forms(word: string): readonly string[] {
  const lower = Str.toLowerCase(word);
  return [lower, `${lower}s`, `${lower}es`];
}

/** Whether a one-word name repeats the word of the folder it stands in, alone or as its plural. */
function repeatsFolder(name: readonly string[], folder: readonly string[]) {
  return Option.match(Option.all([Arr.head(name), Arr.head(folder)]), {
    onNone: () => false,
    onSome: ([word, parent]) =>
      name.length === 1 &&
      folder.length === 1 &&
      (Arr.contains(forms(parent), Str.toLowerCase(word)) ||
        Arr.contains(forms(word), Str.toLowerCase(parent))),
  });
}

/** Collects the folders that hold a Confect function file, and every spec, among the repository's paths. */
function functionsOf(files: readonly string[]) {
  const declared = Arr.filter(files, (file) => {
    const segments = Str.split(file, "/");
    return (
      hasPrefix(segments, SPEC_ROOT) &&
      Option.exists(Arr.last(segments), (name) =>
        FUNCTION_FILE_PATTERN.test(name)
      )
    );
  });
  return {
    folders: HashSet.fromIterable(
      Arr.flatMap(declared, (file) => {
        const segments = Str.split(file, "/");
        return Arr.map(
          Arr.range(SPEC_ROOT.length, segments.length - 2),
          (index) => path(segments, index)
        );
      })
    ),
    specs: HashSet.fromIterable(
      Arr.filter(declared, (file) => file.endsWith(SPEC_SUFFIX))
    ),
  };
}

/** Whether a file of the backend's Confect functions declares or implements one, by its own name or beside its spec. */
function isFunctionFile(
  segments: readonly string[],
  segment: string,
  functions: ReturnType<typeof functionsOf>
) {
  const spec = SPLIT_FUNCTION_PATTERN.exec(segment)?.groups?.spec;
  return (
    FUNCTION_FILE_PATTERN.test(segment) ||
    (spec !== undefined &&
      HashSet.has(
        functions.specs,
        `${Arr.join(Arr.dropRight(segments, 1), "/")}/${spec}${SPEC_SUFFIX}`
      ))
  );
}

/**
 * Whether the segment at `index` is a name that another owner gives: a tool's dot-file or dot-folder and what a tool keeps
 * in a dot-folder below the repository's root, a tool's output, a
 * workspace's package, a URL, a platform module, a content slug, a registry's component, or a backend function, table
 * or component.
 */
function isGiven(
  segments: readonly string[],
  segment: string,
  index: number,
  functions: ReturnType<typeof functionsOf>
) {
  const isFolder = index < segments.length - 1;
  const inApp = segments[0] === "apps";
  const below = (prefix: readonly string[]) =>
    hasPrefix(segments, prefix) && index >= prefix.length;
  return (
    segment.startsWith(".") ||
    Arr.some(Arr.drop(Arr.take(segments, index), 1), (folder) =>
      folder.startsWith(".")
    ) ||
    (!isFolder && GENERATED_FILE_PATTERN.test(segment)) ||
    HashSet.has(GENERATED_FOLDERS, segment) ||
    Arr.some(Arr.take(segments, index), (folder) =>
      HashSet.has(GENERATED_FOLDERS, folder)
    ) ||
    (index === 1 &&
      Option.exists(Arr.head(segments), (root) =>
        HashSet.has(WORKSPACE_ROOTS, root)
      )) ||
    (inApp &&
      Arr.some(ADDRESS_FOLDERS, (folder) =>
        below([...Arr.take(segments, 2), ...folder])
      )) ||
    (inApp && below([...Arr.take(segments, 2), STUB_FOLDER])) ||
    Arr.some(CONTENT_ROOTS, (root) => isFolder && below(root)) ||
    Arr.some(COMPONENT_SET_DIRECTORIES, (directory) =>
      `${Arr.join(Arr.take(segments, index), "/")}/`.startsWith(directory)
    ) ||
    below(FUNCTION_ROOT) ||
    below(COMPONENT_ROOT) ||
    (below(TABLE_ROOT) && index === TABLE_ROOT.length) ||
    (below(SPEC_ROOT) &&
      (isFolder
        ? HashSet.has(functions.folders, path(segments, index))
        : isFunctionFile(segments, segment, functions)))
  );
}

/**
 * Reports each hand-written file or folder name of more than one word, and each one-word name that repeats the word of
 * the folder it stands in. A role suffix such as `.test` or `.server` names no capability, an uppercase document keeps
 * its conventional name, and the names other owners give stay as they are (`isGiven`).
 */
export function nameViolations(files: readonly string[]): readonly string[] {
  const functions = functionsOf(files);
  return Arr.dedupe(
    Arr.flatMap(files, (file) => {
      const segments = Str.split(file, "/");
      return Arr.filterMap(segments, (segment, index) => {
        const isFile = index === segments.length - 1;
        if (
          isGiven(segments, segment, index, functions) ||
          (isFile && DOCUMENT_PATTERN.test(segment))
        ) {
          return Result.failVoid;
        }
        const name = words(segment, isFile);
        if (name.length > 1) {
          return Result.succeed(
            `${path(segments, index)}: ${segment} names more than one word. Name every file and folder with one domain word, and group a longer capability under its own folder.`
          );
        }
        const parent = Option.filter(
          Arr.get(segments, index - 1),
          (folder) => !isGiven(segments, folder, index - 1, functions)
        );
        return Option.exists(parent, (folder) =>
          repeatsFolder(name, words(folder, false))
        )
          ? Result.succeed(
              `${path(segments, index)}: ${segment} repeats its folder's word. Name what the module adds to its folder.`
            )
          : Result.failVoid;
      });
    })
  );
}

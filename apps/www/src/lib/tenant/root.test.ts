// @vitest-environment node

import { NodeServices } from "@effect/platform-node";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { DEFAULT_LOCALE, LOCALES } from "@repo/internationalization/src/locale";
import { getRouteMessages } from "@repo/internationalization/src/messages";
import {
  Array as Arr,
  Effect,
  FileSystem,
  MutableHashSet,
  Option,
  Path,
  Predicate,
  Record,
  Result,
  String as Str,
} from "effect";
import type { PlatformError } from "effect/PlatformError";
import {
  readSchoolLocale,
  readSchoolRoot,
  SchoolMessagesUnavailable,
} from "@/lib/tenant/root";

vi.mock("@repo/internationalization/src/messages", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@repo/internationalization/src/messages")
    >();
  return { ...actual, getRouteMessages: vi.fn(actual.getRouteMessages) };
});

/** A module a source imports by name, statically or on demand: `from "@/x"` or `import("@/x")`. */
const IMPORT = /(?:\bfrom|\bimport\()\s*"(?<module>[^"]+)"/gu;

/** A translator bound to one namespace, such as `const t = useTranslations("School")`. */
const TRANSLATOR =
  /\bconst\s+(?<name>\w+)\s*=\s*useTranslations\(\s*"(?<namespace>\w+)"\s*\)/gu;

/** A message read by a literal key, such as `t("title")` or `t.rich("title"`. */
const READ =
  /\b(?<translator>\w+)(?:\.(?:has|markup|raw|rich))?\(\s*"(?<key>[^"]+)"/gu;

/** The workspace folders that a module name names, so the walk follows the app's own modules and the design system's. */
const MODULE_ROOTS = [
  { folder: "src", prefix: "@/" },
  { folder: "../../packages/design-system", prefix: "@repo/design-system/" },
] as const;

/** Whether a dictionary holds a message at a dotted key, as use-intl reads nested keys. */
function holds(messages: unknown, key: string) {
  return Arr.reduce(Str.split(key, "."), Option.some(messages), (node, part) =>
    Option.flatMap(node, (value) =>
      Predicate.isObject(value) ? Record.get(value, part) : Option.none()
    )
  ).pipe(Option.isSome);
}

/**
 * The messages that a source renders. Each literal read belongs to the nearest translator of its name above it, so
 * two components of one module that both name their translator `t` keep their own namespaces.
 */
function renderedMessages(file: string, text: string) {
  const translators = Arr.map(
    Arr.fromIterable(Str.matchAll(TRANSLATOR)(text)),
    (match) => ({ at: match.index ?? 0, name: match[1], namespace: match[2] })
  );
  const reads = Arr.getSomes(
    Arr.map(Arr.fromIterable(Str.matchAll(READ)(text)), (match) =>
      Option.map(
        Arr.findLast(
          translators,
          (translator) =>
            translator.name === match[1] && translator.at < (match.index ?? 0)
        ),
        (translator) => ({
          file,
          key: Option.some(match[2]),
          namespace: translator.namespace,
        })
      )
    )
  );
  return Arr.appendAll(
    Arr.map(translators, (translator) => ({
      file,
      key: Option.none<string>(),
      namespace: translator.namespace,
    })),
    reads
  );
}

/** One message that a module renders: its namespace, and its key when the module names it by a literal. */
type RenderedMessage = ReturnType<typeof renderedMessages>[number];

/** The source file a module name resolves to, when it names one of the walked workspaces. */
const resolveModule = Effect.fn(function* (from: string, name: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const base = Arr.findFirst(MODULE_ROOTS, (root) =>
    Str.startsWith(root.prefix)(name)
  ).pipe(
    Option.map((root) =>
      path.resolve(root.folder, Str.slice(root.prefix.length)(name))
    ),
    Option.orElse(() =>
      Str.startsWith(".")(name)
        ? Option.some(path.resolve(path.dirname(from), name))
        : Option.none()
    )
  );
  if (Option.isNone(base)) {
    return Option.none<string>();
  }
  return yield* Effect.findFirst(
    [`${base.value}.ts`, `${base.value}.tsx`],
    (candidate) => fs.exists(candidate)
  );
});

/** Every message that a module a school route reaches renders, following its static and on-demand imports. */
const schoolRouteMessages = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const routes = path.resolve("src/routes/school");
  const seen = MutableHashSet.empty<string>();
  const visit = (
    file: string
  ): Effect.Effect<
    readonly RenderedMessage[],
    PlatformError,
    FileSystem.FileSystem | Path.Path
  > =>
    Effect.gen(function* () {
      if (MutableHashSet.has(seen, file)) {
        return [];
      }
      MutableHashSet.add(seen, file);
      const text = yield* fs.readFileString(file);
      const targets = yield* Effect.forEach(
        Arr.fromIterable(Str.matchAll(IMPORT)(text)),
        (match) => resolveModule(file, match[1])
      );
      const below = yield* Effect.forEach(Arr.getSomes(targets), visit);
      return Arr.appendAll(renderedMessages(file, text), Arr.flatten(below));
    });
  const entries = yield* fs.readDirectory(routes, { recursive: true });
  const reached = yield* Effect.forEach(
    Arr.filter(entries, (entry) => Str.endsWith(".tsx")(entry)),
    (entry) => visit(path.join(routes, entry))
  );
  return Arr.flatten(reached);
}).pipe(Effect.provide(NodeServices.layer));

/** A browser whose preferred languages and document cookie the test chooses. */
function stubBrowser(languages: readonly string[], cookie: string) {
  vi.stubGlobal("navigator", { languages });
  vi.stubGlobal("document", { cookie });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readSchoolLocale", () => {
  it("reads the language cookie before the browser's preferred languages", () => {
    stubBrowser(["id-ID", "en"], "theme=dark; NAKAFA_LOCALE=de");
    expect(readSchoolLocale()).toBe("de");
  });

  it("reads the browser's preferred languages without a cookie", () => {
    stubBrowser(["id-ID", "en"], "");
    expect(readSchoolLocale()).toBe("id");
  });

  it("falls back to the default locale when no language is served", () => {
    stubBrowser(["fr-FR"], "");
    expect(readSchoolLocale()).toBe(DEFAULT_LOCALE);
  });
});

describe("readSchoolRoot", () => {
  it.effect(
    "answers the negotiated locale, only the school's messages, and the browser's instant",
    () =>
      Effect.gen(function* () {
        stubBrowser(["id-ID"], "");
        const root = yield* readSchoolRoot();
        expect(root.locale).toBe("id");
        expect(root.now).toBeInstanceOf(Date);
        expect(Record.keys(root.messages)).toStrictEqual(
          expect.arrayContaining([
            "School",
            "SchoolSettings",
            "Exams",
            "Common",
          ])
        );
        expect(Record.keys(root.messages)).not.toContain("Pricing");
      })
  );

  it.effect("fails with its own error when the dictionary cannot load", () =>
    Effect.gen(function* () {
      stubBrowser(["en"], "");
      vi.mocked(getRouteMessages).mockRejectedValueOnce(new Error("offline"));
      const failure = yield* readSchoolRoot().pipe(Effect.flip);
      expect(failure).toBeInstanceOf(SchoolMessagesUnavailable);
    })
  );
});

describe("the school's message namespaces", () => {
  it.effect(
    "carry every namespace and literal key that a module a school route reaches renders, in every locale",
    () =>
      Effect.gen(function* () {
        const rendered = yield* schoolRouteMessages;
        expect(
          Arr.some(rendered, (message) => message.namespace === "Connectors")
        ).toBe(true);
        for (const locale of LOCALES) {
          stubBrowser([locale], "");
          const root = yield* readSchoolRoot();
          // A module names its namespace as text, so the lookup reads the loaded messages by any name.
          const messages: Readonly<Record<string, unknown>> = root.messages;
          const missing = Arr.filterMap(rendered, (message) => {
            const found = Option.match(message.key, {
              onNone: () => Record.has(messages, message.namespace),
              onSome: (key) =>
                Option.exists(
                  Record.get(messages, message.namespace),
                  (value) => holds(value, key)
                ),
            });
            return found
              ? Result.failVoid
              : Result.succeed(
                  `${locale} ${message.namespace}.${Option.getOrElse(message.key, () => "*")} in ${message.file}`
                );
          });
          expect(missing).toEqual([]);
        }
      })
  );
});

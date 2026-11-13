import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { readAuthoredTree } from "#scripts/check/files";
import { inspectMessageReach, messageFindings } from "#scripts/check/messages";

/** The repository root, two folders above this test. */
const REPOSITORY = `${import.meta.dirname}/../..`;
const RULE =
  "add the namespace to the list this route loads, or render the module under a route that loads it";
const PROVIDER =
  "draw a route's messages with MessagesProvider from @/lib/i18n/provider, whose report fails a strict build on a missing message, instead of use-intl's IntlProvider";
const UNNAMED =
  "name the namespace of useTranslations with a string literal, so each route's messages can be checked";
const NAMESPACES = [
  "Ads",
  "Comments",
  "Common",
  "Editor",
  "Emoji",
  "Error",
  "Hidden",
  "Marketing",
  "School",
  "Toast",
];
const STANDALONE = ["NotFound"];

const ROOT = "apps/www/src/routes/__root.tsx";
const LOCALE = "apps/www/src/routes/$locale.tsx";
const MAIN = "apps/www/src/routes/$locale/_main.tsx";
const LESSON = "apps/www/src/routes/$locale/_main/lesson.tsx";
const SHELL = "apps/www/src/lib/i18n/shell.ts";
const WRITER = "apps/www/src/components/comments/writer.tsx";
const CHOOSER = "apps/www/src/components/comments/chooser.tsx";
const PANEL = "apps/www/src/components/emoji/panel.tsx";
const TYPED = "apps/www/src/components/typed.tsx";
const CANVAS = "packages/design-system/components/canvas.tsx";

/** A module as the check reads it: its repository path and its text. */
function source(file: string, sourceText: string) {
  return { file, sourceText };
}

/** A component module that reads one namespace. */
function reader(file: string, namespace: string, extra = "") {
  return source(
    file,
    `import { useTranslations } from "use-intl";
${extra}
export function Part() {
  const t = useTranslations("${namespace}");
  return t("title");
}
`
  );
}

/** The lesson tree: a root, the locale layout, the main layout and a page that renders the comment writer. */
const LESSON_TREE = [
  source(ROOT, "export const Route = {};\n"),
  source(
    LOCALE,
    `const SHELL_NAMESPACES = ["Toast"] as const;
export const loader = () => readRouteMessages({ namespaces: SHELL_NAMESPACES });
`
  ),
  source(
    SHELL,
    'export const SHELL_MESSAGE_NAMESPACES = ["Common"] as const satisfies readonly string[];\n'
  ),
  source(
    MAIN,
    `import { SHELL_MESSAGE_NAMESPACES } from "@/lib/i18n/shell";
const MAIN_NAMESPACES = [...SHELL_MESSAGE_NAMESPACES, "Comments"] as const;
export const loader = () => readRouteMessages({ namespaces: (MAIN_NAMESPACES) });
`
  ),
  source(
    LESSON,
    `import { Writer } from "@/components/comments/writer";
import type { Typed } from "@/components/typed";
import { Canvas } from "@repo/design-system/components/canvas";
export const lazy = () => import("@/components/emoji/panel");
export const Route = [Writer, Canvas];
`
  ),
  reader(WRITER, "Editor", 'import { Chooser } from "./chooser";'),
  source(
    CHOOSER,
    `export { Panel } from "../emoji/panel";
export function Chooser() {
  return useTranslations("Common");
}
`
  ),
  reader(PANEL, "Emoji"),
  reader(TYPED, "Hidden"),
  reader(CANVAS, "Error"),
];

describe("route message reach", () => {
  it.effect(
    "reports each namespace that a route renders and that neither it nor a layout above it loads",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* messageFindings(LESSON_TREE, NAMESPACES, STANDALONE),
          [
            `${LESSON}: ${WRITER} reads the Editor messages, which neither this route nor a layout above it loads: ${RULE}.`,
            `${LESSON}: ${PANEL} reads the Emoji messages, which neither this route nor a layout above it loads: ${RULE}.`,
            `${LESSON}: ${CANVAS} reads the Error messages, which neither this route nor a layout above it loads: ${RULE}.`,
          ]
        );
      })
  );

  it.effect(
    "takes the keys that a translator without a namespace reads from the modules its route walks",
    () =>
      Effect.gen(function* () {
        const menu = "apps/www/src/components/menu.tsx";
        const sections = "apps/www/src/lib/sections.ts";
        const page = "apps/www/src/routes/pricing.tsx";
        const findings = yield* messageFindings(
          [
            source(
              page,
              'import { Menu } from "@/components/menu";\nexport const loader = () => ({ namespaces: ["Marketing"] });\n'
            ),
            source(
              menu,
              `import { SECTIONS } from "@/lib/sections";
export function Menu() {
  const t = useTranslations();
  return SECTIONS.map((section) => t(section));
}
`
            ),
            source(
              sections,
              'export const SECTIONS = ["Marketing.pricing", `Marketing.faq`, `Ads.${"slot"}`, `Comments.${1}x`, "plain.text", "Unknown.key"];\n'
            ),
          ],
          NAMESPACES,
          STANDALONE
        );
        assert.deepStrictEqual(findings, [
          `${page}: ${menu} reads the Ads messages, which neither this route nor a layout above it loads: ${RULE}.`,
          `${page}: ${menu} reads the Comments messages, which neither this route nor a layout above it loads: ${RULE}.`,
        ]);
      })
  );

  it.effect(
    "lets a module that reads the standalone dictionaries render their namespaces through its own provider",
    () =>
      Effect.gen(function* () {
        const page = "apps/www/src/routes/[_]notfound.$locale.tsx";
        const state = "apps/www/src/components/state/localized.tsx";
        const tenant = "apps/www/src/components/tenant/missing.tsx";
        const findings = yield* messageFindings(
          [
            source(
              page,
              'import { Localized } from "@/components/state/localized";\nimport { Missing } from "@/components/tenant/missing";\n'
            ),
            reader(
              state,
              "NotFound",
              "const messages = readStandaloneMessages(locale);"
            ),
            reader(tenant, "NotFound"),
          ],
          NAMESPACES,
          STANDALONE
        );
        assert.deepStrictEqual(findings, [
          `${page}: ${tenant} reads the NotFound messages, which neither this route nor a layout above it loads: ${RULE}.`,
        ]);
      })
  );

  it.effect(
    "follows a folder layout, a list a helper module loads, and a list it imports, and leaves a forwarded list aside",
    () =>
      Effect.gen(function* () {
        const school = "apps/www/src/routes/school.tsx";
        const layout = "apps/www/src/routes/school/$slug/route.tsx";
        const page = "apps/www/src/routes/school/$slug/index.tsx";
        const sibling = "apps/www/src/routes/school/$slug/grades.tsx";
        const root = "apps/www/src/lib/tenant/root.ts";
        const lists = "apps/www/src/lib/tenant/lists.ts";
        const loader = "apps/www/src/lib/i18n/rendered.ts";
        const findings = yield* messageFindings(
          [
            source(
              school,
              'import { readSchoolRoot } from "@/lib/tenant/root";\nimport { render } from "@/lib/i18n/rendered";\n'
            ),
            source(
              root,
              `import { SCHOOL, missing } from "@/lib/tenant/lists";
import { absent } from "@/lib/tenant/gone";
import * as all from "@/lib/tenant/lists";
import plain from "@/lib/tenant/lists";
let later;
export const readSchoolRoot = () => [getRouteMessages(locale, SCHOOL), getRouteMessages(locale, missing), getRouteMessages(locale, absent), getRouteMessages(locale, later), getRouteMessages(locale, [name, "Toast"]), pickRouteMessages(locale)];
`
            ),
            source(lists, 'export const SCHOOL = ["Common"] as const;\n'),
            source(
              loader,
              "export const render = (data) => getRouteMessages(data.locale, data.namespaces);\n"
            ),
            source(
              layout,
              'export const loader = () => ({ namespaces: ["School"] });\n'
            ),
            reader(page, "School"),
            source(
              sibling,
              'import { Sheet } from "@/components/sheet";\nexport const loader = () => ({ namespaces: ["Ads"] });\n'
            ),
            reader("apps/www/src/components/sheet.tsx", "Toast"),
          ],
          NAMESPACES,
          STANDALONE
        );
        assert.deepStrictEqual(findings, []);
      })
  );

  it.effect(
    "reports a translator whose namespace is not a literal, and finds nothing without app routes",
    () =>
      Effect.gen(function* () {
        const page = "apps/www/src/routes/agent.tsx";
        assert.deepStrictEqual(
          yield* messageFindings(
            [
              source(
                page,
                "export function Agent({ name }) {\n  const t = useTranslations(name);\n  return t;\n}\n"
              ),
            ],
            NAMESPACES,
            STANDALONE
          ),
          [`${page}:2: ${UNNAMED}.`]
        );
        assert.deepStrictEqual(
          yield* messageFindings(
            [reader(WRITER, "Editor"), source("scripts/x.ts", "")],
            NAMESPACES,
            STANDALONE
          ),
          []
        );
      })
  );

  it.effect("lets only the provider module draw use-intl's own provider", () =>
    Effect.gen(function* () {
      const page = "apps/www/src/routes/plain.tsx";
      const provider = "apps/www/src/lib/i18n/provider.tsx";
      assert.deepStrictEqual(
        yield* messageFindings(
          [
            source(
              page,
              'import { IntlProvider as Provider, useLocale } from "use-intl";\nimport { MessagesProvider } from "@/lib/i18n/provider";\nimport type { Locale } from "use-intl";\nimport * as intl from "use-intl";\nexport const parts = [Provider, MessagesProvider, useLocale, intl];\n'
            ),
            source(
              provider,
              'import { IntlProvider } from "use-intl";\nexport function MessagesProvider() {\n  return IntlProvider;\n}\n'
            ),
          ],
          NAMESPACES,
          STANDALONE
        ),
        [`${page}: ${PROVIDER}.`]
      );
    })
  );

  it.effect(
    "reads a repository's routes and dictionaries from disk, and a repository without dictionaries names no namespace",
    () =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fileSystem.makeTempDirectoryScoped();
        const page = path.join(root, "apps/www/src/routes/page.tsx");
        const test = path.join(root, "apps/www/src/routes/page.test.ts");
        yield* fileSystem.makeDirectory(path.dirname(page), {
          recursive: true,
        });
        yield* fileSystem.writeFileString(
          page,
          'export function Page() {\n  return useTranslations("Common");\n}\n'
        );
        yield* fileSystem.writeFileString(test, "");
        assert.deepStrictEqual(yield* inspectMessageReach(root, [page, test]), [
          `apps/www/src/routes/page.tsx: apps/www/src/routes/page.tsx reads the Common messages, which neither this route nor a layout above it loads: ${RULE}.`,
        ]);
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.effect(
    "holds every Nakafa route to the namespaces its modules render",
    () =>
      Effect.gen(function* () {
        const { workspaces } = yield* readAuthoredTree(REPOSITORY);
        assert.deepStrictEqual(
          yield* inspectMessageReach(REPOSITORY, workspaces),
          []
        );
      }).pipe(Effect.provide(NodeServices.layer)),
    120_000
  );
});

import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Path, Record as Rec } from "effect";
import { manifestEntries, nameViolations } from "#scripts/check/names";

const MULTI =
  "names more than one word. Name every file and folder with one domain word, and group a longer capability under its own folder.";
const REPEAT =
  "repeats its folder's word. Name what the module adds to its folder.";
const INDEX =
  "names no capability, and a folder import resolves to it as if it were a barrel. Name the module by the domain word of what it renders or does; only a route file, generated output, and the entry a workspace manifest names are called index.";

/** Writes files below one temporary repository root, which the scope removes. */
const repository = Effect.fn("NamePolicyTest.repository")(function* (
  files: Readonly<Record<string, string>>
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fileSystem.makeTempDirectoryScoped({
    prefix: "name-policy-",
  });
  yield* Effect.forEach(
    Rec.toEntries(files),
    ([file, content]) =>
      Effect.andThen(
        fileSystem.makeDirectory(path.dirname(path.join(root, file)), {
          recursive: true,
        }),
        fileSystem.writeFileString(path.join(root, file), content)
      ),
    { discard: true }
  );
  return root;
});

describe("Name policy", () => {
  it("rejects a file or folder name of more than one word, once per folder", () => {
    assert.deepStrictEqual(
      nameViolations(
        [
          "apps/www/src/lib/routing/not-found.ts",
          "packages/seo/json-ld/article.ts",
          "packages/seo/json-ld/course.ts",
          "packages/backend/confect/billing/grantEnd.ts",
          "apps/cas/scripts/cpu_budget.py",
          "packages/analytics/HTTPClient.ts",
        ],
        []
      ),
      [
        `apps/www/src/lib/routing/not-found.ts: not-found.ts ${MULTI}`,
        `packages/seo/json-ld: json-ld ${MULTI}`,
        `packages/backend/confect/billing/grantEnd.ts: grantEnd.ts ${MULTI}`,
        `apps/cas/scripts/cpu_budget.py: cpu_budget.py ${MULTI}`,
        `packages/analytics/HTTPClient.ts: HTTPClient.ts ${MULTI}`,
      ]
    );
  });

  it("rejects a name that repeats its folder's word, alone or as its plural, in any case", () => {
    assert.deepStrictEqual(
      nameViolations(
        [
          "apps/www/src/lib/search/search.server.ts",
          "packages/design-system/lib/toy/toys.ts",
          "packages/backend/confect/classroom/tasks/task.ts",
          "packages/design-system/components/Pool/pool.tsx",
          "packages/design-system/lib/boxes/box.ts",
        ],
        []
      ),
      [
        `apps/www/src/lib/search/search.server.ts: search.server.ts ${REPEAT}`,
        `packages/design-system/lib/toy/toys.ts: toys.ts ${REPEAT}`,
        `packages/backend/confect/classroom/tasks/task.ts: task.ts ${REPEAT}`,
        `packages/design-system/components/Pool/pool.tsx: pool.tsx ${REPEAT}`,
        `packages/design-system/lib/boxes/box.ts: box.ts ${REPEAT}`,
      ]
    );
  });

  it("allows role suffixes, numbers, uppercase documents and a name that adds a word", () => {
    assert.deepStrictEqual(
      nameViolations(
        [
          "README.md",
          "docs/adr/0021-rules.md",
          "packages/design-system/CODE_OF_CONDUCT.md",
          "apps/www/src/env.server.ts",
          "apps/www/src/lib/search/query.functions.ts",
          "apps/www/e2e/school/walk.browser.ts",
          "apps/www/vitest.config.ts",
          "apps/www/vitest.setup.ts",
          "packages/design-system/types.d.ts",
          "packages/design-system/lib/toy/pace.test.ts",
          "packages/design-system/lib/toy/2026.ts",
          "packages/design-system/lib/hash/hashing.ts",
          "packages/backend/confect/test.helpers.ts",
          "packages/mascot/nina/test.hit.test.ts",
          "packages/design-system/lib/test.ts",
        ],
        []
      ),
      []
    );
  });

  it("leaves the names other owners give: tools, workspaces, URLs, stubs, slugs, registries and the backend's API", () => {
    assert.deepStrictEqual(
      nameViolations(
        [
          "apps/cas/.python-version",
          "apps/cas/.venv/lib/site-packages/typing_extensions.py",
          "apps/www/.cache/static-pages.json",
          "apps/www/src/routeTree.gen.ts",
          "packages/backend/confect/_generated/refs/contentRelease.ts",
          "packages/contracts/dist/source-map.js",
          "packages/typescript-config/base.json",
          "packages/design-system/package.json",
          "apps/www/src/routes/$locale/_entry/verify.$hash.tsx",
          "apps/www/public/apple-touch-icon.png",
          "apps/cas/typings/_cloudflare/allow_entropy.pyi",
          "packages/design-system/components/contents/physics/parabolic-movement/graph.tsx",
          "packages/design-system/components/ui/dropdown-menu.tsx",
          "packages/design-system/components/evilcharts/charts/area-chart.tsx",
          "packages/backend/convex/contentRelease/accept.ts",
          "packages/backend/components/betterAuth/adapter.ts",
          "packages/backend/confect/tables/accountConsentDecisions.ts",
          "packages/backend/confect/contentRelease/quran/tafsir.spec.ts",
          "packages/backend/confect/tryouts/queries/attemptPage.impl.ts",
          "packages/backend/confect/tryouts/queries/attemptPage.impl.test.ts",
          "packages/backend/confect/tryouts/attemptPage/spec.ts",
          "packages/backend/confect/tryouts/attemptPage/impl.ts",
          "packages/backend/confect/access/grants.spec.ts",
          "packages/backend/confect/access/grants.change.ts",
          "packages/backend/confect/access/grants.change.test.ts",
        ],
        []
      ),
      []
    );
  });

  it("still judges a hand-written name beside or below a given one", () => {
    assert.deepStrictEqual(
      nameViolations(
        [
          "packages/design-system/components/contents/biology/virus-parts.tsx",
          "packages/backend/confect/tryouts/attemptPage/page.ts",
          "packages/backend/confect/tables/accounts/consent-decision.ts",
          "apps/www/src/routing/not-found.ts",
          ".agents/skills/content/check-points.ts",
          "packages/backend/confect/tenancy/cohorts.spec.ts",
          "packages/backend/confect/tenancy/cohort.restore.ts",
          "packages/backend/confect/tenancy/units.restore.ts",
        ],
        []
      ),
      [
        `packages/design-system/components/contents/biology/virus-parts.tsx: virus-parts.tsx ${MULTI}`,
        `packages/backend/confect/tryouts/attemptPage: attemptPage ${MULTI}`,
        `packages/backend/confect/tables/accounts/consent-decision.ts: consent-decision.ts ${MULTI}`,
        `apps/www/src/routing/not-found.ts: not-found.ts ${MULTI}`,
        `.agents/skills/content/check-points.ts: check-points.ts ${MULTI}`,
        `packages/backend/confect/tenancy/cohort.restore.ts: cohort.restore.ts ${MULTI}`,
        `packages/backend/confect/tenancy/units.restore.ts: units.restore.ts ${MULTI}`,
      ]
    );
  });
});

describe("Index modules", () => {
  it("rejects a module named index anywhere a hand-written or given name stands", () => {
    assert.deepStrictEqual(
      nameViolations(
        [
          "packages/design-system/index.tsx",
          "apps/www/src/components/auth/index.tsx",
          "apps/www/src/components/auth/index.test.ts",
          "packages/design-system/components/ui/index.ts",
          "packages/design-system/components/contents/biology/index.tsx",
          "packages/backend/convex/index.ts",
          "apps/www/src/lib/llms/index/render.ts",
        ],
        []
      ),
      [
        `packages/design-system/index.tsx: index.tsx ${INDEX}`,
        `apps/www/src/components/auth/index.tsx: index.tsx ${INDEX}`,
        `apps/www/src/components/auth/index.test.ts: index.test.ts ${INDEX}`,
        `packages/design-system/components/ui/index.ts: index.ts ${INDEX}`,
        `packages/design-system/components/contents/biology/index.tsx: index.tsx ${INDEX}`,
        `packages/backend/convex/index.ts: index.ts ${INDEX}`,
      ]
    );
  });

  it("keeps index for a route file, a public asset, generated output, and a manifest's entry", () => {
    assert.deepStrictEqual(
      nameViolations(
        [
          "apps/www/src/routes/school/index.tsx",
          "apps/www/public/index.html",
          "packages/backend/convex/_generated/index.ts",
          "apps/www/src/index.gen.ts",
          "packages/site/index.ts",
          "packages/site/index.test.ts",
          "packages/site/lib/index.ts",
        ],
        ["packages/site/index.ts", "packages/site/domains.ts"]
      ),
      [`packages/site/lib/index.ts: index.ts ${INDEX}`]
    );
  });
});

describe("Manifest entries", () => {
  it.effect(
    "names main and each exports target, nested conditions included, but no pattern or hidden subpath",
    () =>
      Effect.gen(function* () {
        const root = yield* repository({
          "packages/site/package.json":
            '{"exports":{".":"./index.ts","./*":"./*.ts","./hidden":null,"./node":{"import":"./node.ts","default":{"browser":"./browser.ts"}}}}\n',
          "packages/kit/package.json":
            '{"main":"./main.ts","exports":"./kit.ts"}\n',
          "packages/bare/package.json": '{"name":"bare"}\n',
          "packages/kit/fixture/package.json": '{"main":"./nested.ts"}\n',
        });
        assert.deepStrictEqual(
          yield* manifestEntries(root, [
            "packages/site/package.json",
            "packages/kit/package.json",
            "packages/bare/package.json",
            "packages/kit/fixture/package.json",
            "packages/site/index.ts",
          ]),
          [
            "packages/site/index.ts",
            "packages/site/node.ts",
            "packages/site/browser.ts",
            "packages/kit/main.ts",
            "packages/kit/kit.ts",
          ]
        );
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.effect("fails when a workspace manifest is not a manifest", () =>
    Effect.gen(function* () {
      const root = yield* repository({
        "packages/kit/package.json": '{"main":1}\n',
      });
      const error = yield* Effect.flip(
        manifestEntries(root, ["packages/kit/package.json"])
      );
      assert.strictEqual(
        error.message,
        "Unable to read packages/kit/package.json as a package manifest."
      );
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );
});

import { assert, describe, it } from "@effect/vitest";
import { nameViolations } from "#scripts/check/names";

const MULTI =
  "names more than one word. Name every file and folder with one domain word, and group a longer capability under its own folder.";
const REPEAT =
  "repeats its folder's word. Name what the module adds to its folder.";

describe("Name policy", () => {
  it("rejects a file or folder name of more than one word, once per folder", () => {
    assert.deepStrictEqual(
      nameViolations([
        "apps/www/src/lib/routing/not-found.ts",
        "packages/seo/json-ld/article.ts",
        "packages/seo/json-ld/course.ts",
        "packages/backend/confect/billing/grantEnd.ts",
        "apps/cas/scripts/cpu_budget.py",
        "packages/analytics/HTTPClient.ts",
      ]),
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
      nameViolations([
        "apps/www/src/lib/search/search.server.ts",
        "packages/design-system/lib/toy/toys.ts",
        "packages/backend/confect/classroom/tasks/task.ts",
        "packages/design-system/components/Pool/pool.tsx",
        "packages/design-system/lib/boxes/box.ts",
      ]),
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
      nameViolations([
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
      ]),
      []
    );
  });

  it("leaves the names other owners give: tools, workspaces, URLs, stubs, slugs, registries and the backend's API", () => {
    assert.deepStrictEqual(
      nameViolations([
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
      ]),
      []
    );
  });

  it("still judges a hand-written name beside or below a given one", () => {
    assert.deepStrictEqual(
      nameViolations([
        "packages/design-system/components/contents/biology/virus-parts.tsx",
        "packages/backend/confect/tryouts/attemptPage/page.ts",
        "packages/backend/confect/tables/accounts/consent-decision.ts",
        "apps/www/src/routing/not-found.ts",
        ".agents/skills/content/check-points.ts",
        "packages/backend/confect/tenancy/cohorts.spec.ts",
        "packages/backend/confect/tenancy/cohort.restore.ts",
        "packages/backend/confect/tenancy/units.restore.ts",
      ]),
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

import {
  createSourceFile,
  forEachChild,
  isCallExpression,
  isIdentifier,
  isImportDeclaration,
  isNamedImports,
  isNamespaceImport,
  isPropertyAccessExpression,
  isStringLiteral,
  type Node,
  ScriptKind,
  ScriptTarget,
  type SourceFile,
} from "typescript";

export const EFFECT_TEST_ADAPTER = "@repo/testing/effect";

const EFFECT_MODULES = new Set(["effect", "effect/Effect"]);
const DIRECT_EFFECT_RUNNERS = new Set([
  "runCallback",
  "runCallbackWith",
  "runFork",
  "runForkWith",
  "runPromise",
  "runPromiseExit",
  "runPromiseExitWith",
  "runPromiseWith",
  "runSync",
  "runSyncExit",
  "runSyncExitWith",
  "runSyncWith",
]);
const EFFECT_TEST_RUNNER_MIGRATION_BASELINE = new Set([
  "apps/www/app/api/chat/context.test.ts",
  "apps/www/app/api/chat/persistence.test.ts",
  "apps/www/app/api/chat/published.test.ts",
  "apps/www/app/api/chat/utils.test.ts",
  "apps/www/app/api/internal/content/renderer/route.test.ts",
  "apps/www/components/shared/open-content/copy.test.ts",
  "apps/www/lib/analytics/consent/storage.test.ts",
  "apps/www/lib/content/article/catalog.test.ts",
  "apps/www/lib/content/article/category.test.ts",
  "apps/www/lib/content/article/decode.test.ts",
  "apps/www/lib/content/article/discovery.test.ts",
  "apps/www/lib/content/article/navigation.test.ts",
  "apps/www/lib/content/article/route.test.ts",
  "apps/www/lib/content/article/sitemap.test.ts",
  "apps/www/lib/content/cache.test.ts",
  "apps/www/lib/content/material/catalog.test.ts",
  "apps/www/lib/content/material/context.test.ts",
  "apps/www/lib/content/material/decode.test.ts",
  "apps/www/lib/content/material/discovery.test.ts",
  "apps/www/lib/content/material/route.test.ts",
  "apps/www/lib/content/material/sitemap.test.ts",
  "apps/www/lib/content/material/trust.test.ts",
  "apps/www/lib/content/page/catalog.test.ts",
  "apps/www/lib/content/page/navigation.test.ts",
  "apps/www/lib/content/preview/config.test.ts",
  "apps/www/lib/content/preview/events.test.ts",
  "apps/www/lib/content/preview/material.test.ts",
  "apps/www/lib/content/preview/question.test.ts",
  "apps/www/lib/content/preview/request.test.ts",
  "apps/www/lib/content/preview/route.test.ts",
  "apps/www/lib/content/program/cards.test.ts",
  "apps/www/lib/content/program/catalog.test.ts",
  "apps/www/lib/content/program/decode.test.ts",
  "apps/www/lib/content/program/route.test.ts",
  "apps/www/lib/content/published/active.test.ts",
  "apps/www/lib/content/published/exchange.test.ts",
  "apps/www/lib/content/published/origin.test.ts",
  "apps/www/lib/content/published/projection.test.ts",
  "apps/www/lib/content/published/release.test.ts",
  "apps/www/lib/content/published/route.test.ts",
  "apps/www/lib/content/quran/publication.test.ts",
  "apps/www/lib/content/quran/recovery.test.ts",
  "apps/www/lib/content/renderer/components.test.ts",
  "apps/www/lib/content/renderer/manifest.test.ts",
  "apps/www/lib/content/runtime/query.test.ts",
  "apps/www/lib/content/tryout/sitemap.test.ts",
  "apps/www/lib/llms/content-entries.test.ts",
  "apps/www/lib/llms/content-listing.test.ts",
  "apps/www/lib/llms/content.test.ts",
  "apps/www/lib/llms/indexes.test.ts",
  "apps/www/lib/llms/material-pages.test.ts",
  "apps/www/lib/llms/published.test.ts",
  "apps/www/lib/llms/quran.test.ts",
  "apps/www/lib/llms/section.test.ts",
  "apps/www/lib/llms/site.test.ts",
  "apps/www/lib/routing/locale/published.test.ts",
  "apps/www/lib/routing/locale/resolve.test.ts",
  "apps/www/lib/routing/public/migration.test.ts",
  "apps/www/lib/routing/public/projected.test.ts",
  "apps/www/lib/routing/public/source.test.ts",
  "apps/www/lib/sitemap/catalog.test.ts",
  "apps/www/lib/sitemap/entries.test.ts",
  "apps/www/lib/sitemap/routes.test.ts",
  "apps/www/lib/utils/seo/quran.test.ts",
  "apps/www/lib/utils/seo/translations.test.ts",
  "apps/www/scripts/indexing/manifest.test.ts",
  "packages/analytics/consent.test.ts",
  "packages/analytics/posthog/browser.test.ts",
  "packages/analytics/posthog/server.test.ts",
  "packages/backend/convex/contentRelease/article/dates.test.ts",
  "packages/backend/convex/contentRelease/article/order.test.ts",
  "packages/backend/convex/contentRelease/article/predecessor.test.ts",
  "packages/backend/convex/contentRelease/ingress/group.test.ts",
  "packages/backend/convex/contentRelease/ingress/lifecycle.test.ts",
  "packages/backend/convex/contentRelease/ingress/readModels.test.ts",
  "packages/backend/convex/contentRelease/ingress/rollback.test.ts",
  "packages/backend/convex/contentRelease/ingress/stage.test.ts",
  "packages/backend/convex/contentRelease/material/predecessor.test.ts",
  "packages/backend/convex/contentRelease/program/context.test.ts",
  "packages/backend/convex/contentRelease/program/route.test.ts",
  "packages/backend/convex/contentRelease/proof/verify.test.ts",
  "packages/backend/convex/contentRelease/runtime/public/batch.test.ts",
  "packages/backend/convex/contentRelease/runtime/public/dispatch.test.ts",
  "packages/backend/convex/contents/views/context.test.ts",
  "packages/backend/convex/customers/polar/target.test.ts",
  "packages/backend/convex/customers/polar/webhook.test.ts",
  "packages/backend/convex/emails/welcome.test.ts",
  "packages/backend/convex/learningPreferences/mutations.test.ts",
  "packages/backend/convex/tryouts/progress/write.test.ts",
  "packages/backend/convex/tryouts/runtime/access.test.ts",
  "packages/backend/convex/tryouts/runtime/score.test.ts",
  "packages/backend/convex/tryouts/runtime/selectors.test.ts",
  "packages/backend/convex/tryouts/score/result.test.ts",
  "packages/backend/convex/tryouts/sets/page.test.ts",
  "packages/design-system/lib/theme/compatibility.test.ts",
  "packages/design-system/lib/theme/contract.test.ts",
  "packages/design-system/lib/theme/contrast.test.ts",
  "packages/design-system/lib/theme/registry.test.ts",
]);

export interface TestSource {
  readonly path: string;
  readonly source: string;
}

export interface EffectTestRunnerPolicyProblems {
  readonly resolvedBaselineFiles: readonly string[];
  readonly unexpectedRunnerFiles: readonly string[];
}

/** Returns the string module specifier for one static import. */
function importSource(statement: SourceFile["statements"][number]) {
  if (
    !(
      isImportDeclaration(statement) &&
      isStringLiteral(statement.moduleSpecifier)
    )
  ) {
    return;
  }
  return statement.moduleSpecifier.text;
}

/** Collects local names that can invoke an Effect runtime directly. */
function readEffectRunnerBindings(sourceFile: SourceFile) {
  const directRunners = new Set<string>();
  const effectNamespaces = new Set<string>();

  for (const statement of sourceFile.statements) {
    const moduleName = importSource(statement);
    if (!(moduleName && EFFECT_MODULES.has(moduleName))) {
      continue;
    }
    if (!isImportDeclaration(statement)) {
      continue;
    }
    const bindings = statement.importClause?.namedBindings;
    if (!bindings) {
      continue;
    }
    if (isNamespaceImport(bindings)) {
      effectNamespaces.add(bindings.name.text);
      continue;
    }
    if (!isNamedImports(bindings)) {
      continue;
    }

    for (const binding of bindings.elements) {
      const importedName = binding.propertyName?.text ?? binding.name.text;
      if (moduleName === "effect" && importedName === "Effect") {
        effectNamespaces.add(binding.name.text);
      }
      if (
        moduleName === "effect/Effect" &&
        DIRECT_EFFECT_RUNNERS.has(importedName)
      ) {
        directRunners.add(binding.name.text);
      }
    }
  }

  return { directRunners, effectNamespaces };
}

/** Detects a direct Effect runner call without matching comments or strings. */
function callsDirectEffectRunner(sourceFile: SourceFile) {
  const { directRunners, effectNamespaces } =
    readEffectRunnerBindings(sourceFile);
  let found = false;

  const visit = (node: Node) => {
    if (found) {
      return;
    }
    if (isCallExpression(node)) {
      const expression = node.expression;
      if (isIdentifier(expression) && directRunners.has(expression.text)) {
        found = true;
        return;
      }
      if (
        isPropertyAccessExpression(expression) &&
        isIdentifier(expression.expression) &&
        effectNamespaces.has(expression.expression.text) &&
        DIRECT_EFFECT_RUNNERS.has(expression.name.text)
      ) {
        found = true;
        return;
      }
    }
    forEachChild(node, visit);
  };

  forEachChild(sourceFile, visit);
  return found;
}

/** Finds authored tests that invoke an Effect runtime directly. */
export function inspectEffectTestRunnerPolicy(
  tests: readonly TestSource[],
  migrationBaseline: ReadonlySet<string> = EFFECT_TEST_RUNNER_MIGRATION_BASELINE
): EffectTestRunnerPolicyProblems {
  const runnerFiles = new Set(
    tests.flatMap((test) => {
      const sourceFile = createSourceFile(
        test.path,
        test.source,
        ScriptTarget.Latest,
        true,
        ScriptKind.TS
      );
      if (!callsDirectEffectRunner(sourceFile)) {
        return [];
      }
      return [test.path];
    })
  );

  return {
    resolvedBaselineFiles: [...migrationBaseline]
      .filter((file) => !runnerFiles.has(file))
      .sort(),
    unexpectedRunnerFiles: [...runnerFiles]
      .filter((file) => !migrationBaseline.has(file))
      .sort(),
  };
}

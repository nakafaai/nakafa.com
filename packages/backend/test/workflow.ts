import workflowTest from "@convex-dev/workflow/test";
import type schema from "@repo/backend/convex/schema";
import type { TestConvex } from "convex-test";
import { Array as Arr, Record as Rec } from "effect";

/**
 * Loads Workflow modules before its deterministic handler disables process.
 * Vite's loader needs process even for repeated imports, and timer pumping
 * must not race the first module transformation during a scheduled journal call.
 * Register before writing component data so nested Workpool storage stays intact.
 */
export async function registerWorkflow(t: TestConvex<typeof schema>) {
  workflowTest.register(t);
  const runtimeModules = Arr.filter(
    Rec.toEntries(workflowTest.modules),
    ([path]) =>
      !(path.endsWith(".test.ts") || path.endsWith("/convex.config.ts"))
  );
  const entries = await Promise.all(
    Arr.map(runtimeModules, async ([path, load]) => {
      const loaded = await load();
      return [path, () => Promise.resolve(loaded)] as const;
    })
  );
  const modules = Rec.fromEntries(entries);
  t.registerComponent("workflow", workflowTest.schema, modules);
}

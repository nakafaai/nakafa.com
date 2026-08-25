import { aiDsComponentNames } from "@repo/design-system/lib/markdown/names";
import type { RendererComponentLoader } from "@/lib/content/renderer/loader";

export const domainComponentLoaders = [
  {
    name: aiDsComponentNames.lineEquation,
    load: () =>
      import("@/lib/content/renderer/client/ai/equation").then(
        ({ LineEquation }) => LineEquation
      ),
  },
] satisfies readonly RendererComponentLoader[];

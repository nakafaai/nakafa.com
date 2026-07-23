import type { RendererDomain } from "@nakafa/aksara-contracts/renderer/domain";
import { matchesMaterialRouteTarget } from "@/lib/content/material";
import { selectLearningStaticParams } from "@/lib/routing/prerender";

/** One material prerender candidate before physical-route partitioning. */
export interface MaterialStaticParam {
  readonly lesson: readonly string[];
  readonly rendererDomain: RendererDomain;
  readonly subject: string;
  readonly topic: string;
}

/** Mutually exclusive physical-route partitions sharing one global cap. */
interface MaterialStaticPartitions {
  readonly chemistry: readonly MaterialStaticParam[];
  readonly generic: readonly MaterialStaticParam[];
  readonly mathematics: readonly MaterialStaticParam[];
}

/**
 * Applies the learning cap once, then assigns every candidate to one route.
 *
 * This prevents separate physical routes from each prerendering their own 512
 * entries or emitting the same public material URL twice.
 */
export function partitionMaterialStaticParams(
  params: readonly MaterialStaticParam[]
): MaterialStaticPartitions {
  const selected = selectLearningStaticParams(params);

  return {
    chemistry: selected.filter(({ rendererDomain }) =>
      matchesMaterialRouteTarget(rendererDomain, "chemistry")
    ),
    generic: selected.filter(({ rendererDomain }) =>
      matchesMaterialRouteTarget(rendererDomain, "generic")
    ),
    mathematics: selected.filter(({ rendererDomain }) =>
      matchesMaterialRouteTarget(rendererDomain, "mathematics")
    ),
  };
}

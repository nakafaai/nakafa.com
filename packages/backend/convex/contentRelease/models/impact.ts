import type { ContentFamily } from "@nakafa/aksara-contracts/content";
import type { PublicationScope } from "@nakafa/aksara-contracts/release/snapshot/scope";

interface ReadModelImpact {
  readonly article: boolean;
  readonly material: boolean;
  readonly search: boolean;
}

/** Checks whether a release may change one authored content family. */
function changesFamily(scope: PublicationScope, family: ContentFamily) {
  return scope.families.includes(family);
}

/** Derives the read models whose source data may change under one exact scope. */
export function getReadModelImpact(scope: PublicationScope): ReadModelImpact {
  const article = changesFamily(scope, "article");
  const material = changesFamily(scope, "material");
  return {
    article,
    material,
    search: article || material,
  };
}

import type { ContentFamily } from "@nakafa/aksara-contracts/content";
import type { PublicationScope } from "@nakafa/aksara-contracts/release/snapshot/scope";
import { Array as Arr, Schema } from "effect";

const ReadModelImpactSchema = Schema.Struct({
  article: Schema.Boolean,
  material: Schema.Boolean,
  search: Schema.Boolean,
});

type ReadModelImpact = typeof ReadModelImpactSchema.Type;

/** Checks whether a release may change one authored content family. */
function changesFamily(scope: PublicationScope, family: ContentFamily) {
  return Arr.contains(scope.families, family);
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

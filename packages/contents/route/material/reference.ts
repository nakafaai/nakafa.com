import { MaterialKeySchema } from "@nakafa/aksara-contracts/projection/material";
import { LocaleSchema } from "@repo/contents/content";
import { Array as Arr, Option, Schema } from "effect";

const MaterialRouteIdentitySchema = Schema.Struct({
  locale: LocaleSchema,
  materialKey: MaterialKeySchema,
  sourcePath: Schema.String,
});
export type MaterialRouteIdentity = typeof MaterialRouteIdentitySchema.Type;

const MaterialContextIdentitySchema = Schema.Struct({
  nodeKey: Schema.String,
  programKey: Schema.String,
});
export type MaterialContextIdentity = typeof MaterialContextIdentitySchema.Type;

const MaterialContextRefSchema = Schema.Struct({
  ...MaterialContextIdentitySchema.fields,
  anchor: Schema.String,
  locale: LocaleSchema,
  materialKey: MaterialKeySchema,
  parentHref: Schema.String,
  parentTitle: Schema.String,
  sourcePath: Schema.String,
});

/**
 * Source-owned material return context for one concrete lesson and curriculum card.
 *
 * The ref is not a public route row. It only validates optional `ctx` hints and
 * builds the small header return link when a material was opened from a
 * curriculum card list.
 */
export type MaterialContextRef = typeof MaterialContextRefSchema.Type;

/**
 * Returns the matching context ref for one material route and curriculum group.
 *
 * Curriculum card builders use this instead of reconstructing URL query
 * grammar. Missing refs keep the direct canonical material URL.
 */
export function readMaterialContextRef({
  contextRoute,
  refs,
  route,
}: {
  contextRoute: MaterialContextIdentity;
  refs: readonly MaterialContextRef[];
  route: MaterialRouteIdentity;
}) {
  return Option.getOrUndefined(
    Arr.findFirst(
      refs,
      (ref) =>
        ref.locale === route.locale &&
        ref.sourcePath === route.sourcePath &&
        ref.materialKey === route.materialKey &&
        ref.programKey === contextRoute.programKey &&
        ref.nodeKey === contextRoute.nodeKey
    )
  );
}

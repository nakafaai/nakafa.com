import { accessAuthorities } from "@repo/backend/confect/access/authority";
import type { ResourceKind } from "@repo/backend/confect/access/catalog";
import type { Authority } from "@repo/backend/confect/access/policy";
import { tenancyAuthorities } from "@repo/backend/confect/tenancy/authority";

/**
 * One authority per declared kind. A lane adds its authorities with one
 * line; a kind without an authority does not compile.
 */
export const registry: { readonly [K in ResourceKind]: Authority<K> } = {
  ...tenancyAuthorities,
  ...accessAuthorities,
};

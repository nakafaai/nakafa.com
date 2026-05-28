"use client";

import type { Ref } from "@confect/core";
import {
  type ConvexFunctionReference,
  type ConvexFunctionReturn,
  toConvexReference,
} from "@repo/backend/confect/modules/shared/convexReferences";
import {
  type PaginatedQueryArgs,
  type UsePaginatedQueryResult,
  usePaginatedQuery as useConvexPaginatedQuery,
} from "convex/react";

export type PaginationStatus = UsePaginatedQueryResult<never>["status"];

type PaginatedRef = Ref.AnyPublicQuery;

type PaginatedArgs<Query extends PaginatedRef> = PaginatedQueryArgs<
  ConvexFunctionReference<Query>
>;

type PaginatedItem<Query extends PaginatedRef> =
  ConvexFunctionReturn<Query> extends { page: (infer Item)[] } ? Item : never;

type PaginatedQuery<Query extends PaginatedRef> =
  Ref.Args<Query> extends { readonly paginationOpts: unknown }
    ? Ref.Returns<Query> extends { readonly page: readonly unknown[] }
      ? Query
      : never
    : never;

export type ConfectPaginatedQueryResult<Query extends PaginatedRef> =
  UsePaginatedQueryResult<PaginatedItem<Query>>;

/**
 * Runs a Confect paginated public query through Convex's pagination hook.
 *
 * Confect 8 does not expose `usePaginatedQuery` yet, so this is the single
 * documented React adapter for native Convex pagination.
 *
 * References:
 * - https://confect.dev/clients/http
 * - https://docs.convex.dev/database/pagination
 * - https://github.com/rjdellecese/confect/pull/390
 */
export function usePaginatedQuery<Query extends PaginatedRef>(
  ref: PaginatedQuery<Query>,
  args: PaginatedArgs<PaginatedQuery<Query>> | "skip",
  options: { initialNumItems: number }
): ConfectPaginatedQueryResult<PaginatedQuery<Query>> {
  return useConvexPaginatedQuery(toConvexReference(ref), args, options);
}

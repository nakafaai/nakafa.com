import { Ref } from "@confect/core";
import { RegisteredConvexFunction } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type schema from "@repo/backend/convex/schema";
import type { FunctionReference } from "convex/server";
import type { TestConvex } from "convex-test";
import { Effect } from "effect";

/** Runs a Confect program in one convex-test mutation, the way a Confect mutation runs it. */
export const inMutation =
  <A, E>(
    program: (
      ctx: MutationCtx
    ) => Effect.Effect<
      A,
      E,
      RegisteredConvexFunction.MutationServices<typeof databaseSchema>
    >
  ) =>
  (ctx: MutationCtx) =>
    Effect.runPromise(
      program(ctx).pipe(
        Effect.provide(
          RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)
        )
      )
    );

/**
 * Calls public functions as one identity and decodes their returns and typed
 * failures through each function's own contract, so tests match errors by tag.
 */
export const client = (
  convex: ReturnType<TestConvex<typeof schema>["withIdentity"]>
) => ({
  action: <R extends Ref.AnyPublic & Ref.AnyAction>(
    ref: R,
    args: Ref.Args<R>
  ) =>
    Ref.runWithCodec(
      ref,
      args,
      (reference: FunctionReference<"action", "public">, encoded) =>
        convex.action(reference, encoded)
    ),
  mutation: <R extends Ref.AnyPublicMutation>(ref: R, args: Ref.Args<R>) =>
    Ref.runWithCodec(
      ref,
      args,
      (reference: FunctionReference<"mutation">, encoded) =>
        convex.mutation(reference, encoded)
    ),
  query: <R extends Ref.AnyPublicQuery>(ref: R, args: Ref.Args<R>) =>
    Ref.runWithCodec(
      ref,
      args,
      (reference: FunctionReference<"query">, encoded) =>
        convex.query(reference, encoded)
    ),
});

/** Calls internal functions the way the platform and `convex run` do, with no identity, decoding their contracts. */
export const internalClient = (convex: TestConvex<typeof schema>) => ({
  action: <R extends Ref.AnyInternal & Ref.AnyAction>(
    ref: R,
    args: Ref.Args<R>
  ) =>
    Ref.runWithCodec(
      ref,
      args,
      (reference: FunctionReference<"action", "internal">, encoded) =>
        convex.action(reference, encoded)
    ),
  mutation: <R extends Ref.AnyInternal & Ref.AnyMutation>(
    ref: R,
    args: Ref.Args<R>
  ) =>
    Ref.runWithCodec(
      ref,
      args,
      (reference: FunctionReference<"mutation", "internal">, encoded) =>
        convex.mutation(reference, encoded)
    ),
  query: <R extends Ref.AnyInternal & Ref.AnyQuery>(
    ref: R,
    args: Ref.Args<R>
  ) =>
    Ref.runWithCodec(
      ref,
      args,
      (reference: FunctionReference<"query", "internal">, encoded) =>
        convex.query(reference, encoded)
    ),
});

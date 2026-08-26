import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Effect, Schema } from "effect";
import {
  LlmsProxyRouteDecisionSchema,
  resolveLlmsProxyRoute,
} from "@/lib/llms/routes";
import { readProjectedHtmlRouteRejection } from "@/lib/routing/public/projected";
import { readSourceBackedHtmlRouteRejection } from "@/lib/routing/public/source";

export const PublicDocumentRouteInputSchema = Schema.Struct({
  acceptHeader: Schema.Option(Schema.String),
  hasAttemptCapability: Schema.Boolean,
  method: Schema.String,
  pathname: Schema.String,
});
export type PublicDocumentRouteInput =
  typeof PublicDocumentRouteInputSchema.Type;

export const PublicDocumentRouteDecisionSchema = Schema.Union([
  LlmsProxyRouteDecisionSchema,
  Schema.Struct({
    kind: Schema.Literal("not-found"),
    locale: AppLocaleCodeSchema,
  }),
]);
export type PublicDocumentRouteDecision =
  typeof PublicDocumentRouteDecisionSchema.Type;

/** Resolves public document ownership before adapting it to a Next response. */
export const resolvePublicDocumentRoute = Effect.fn(
  "www.routing.publicDocument.resolve"
)(function* (input: PublicDocumentRouteInput) {
  const sourceBackedRouteRejection = yield* readSourceBackedHtmlRouteRejection({
    method: input.method,
    pathname: input.pathname,
  });
  if (sourceBackedRouteRejection) {
    return {
      kind: "not-found",
      locale: sourceBackedRouteRejection,
    } satisfies PublicDocumentRouteDecision;
  }

  const representation = yield* resolveLlmsProxyRoute({
    acceptHeader: input.acceptHeader,
    method: input.method,
    pathname: input.pathname,
  });
  if (representation.kind === "rewrite-markdown") {
    return representation;
  }

  const projectedRouteRejection = yield* readProjectedHtmlRouteRejection({
    hasAttemptCapability: input.hasAttemptCapability,
    pathname: input.pathname,
  });
  if (projectedRouteRejection) {
    return {
      kind: "not-found",
      locale: projectedRouteRejection,
    } satisfies PublicDocumentRouteDecision;
  }

  return representation;
});

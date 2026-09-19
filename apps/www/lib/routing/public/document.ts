import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Effect, Schema } from "effect";
import {
  LlmsProxyRouteDecisionSchema,
  LlmsProxyRouteRequestSchema,
  readLlmsMarkdownPathname,
  resolveLlmsProxyRoute,
} from "@/lib/llms/routes";
import { readProjectedHtmlRouteRejection } from "@/lib/routing/public/projected";
import { readSourceBackedHtmlRouteRejection } from "@/lib/routing/public/source";

const PublicDocumentRouteInputSchema = Schema.Struct({
  ...LlmsProxyRouteRequestSchema.fields,
  hasAttemptCapability: Schema.Boolean,
});
type PublicDocumentRouteInput = typeof PublicDocumentRouteInputSchema.Type;

const PublicDocumentRouteDecisionSchema = Schema.Union([
  LlmsProxyRouteDecisionSchema,
  Schema.Struct({
    kind: Schema.Literal("not-found"),
    locale: AppLocaleCodeSchema,
  }),
]);
type PublicDocumentRouteDecision =
  typeof PublicDocumentRouteDecisionSchema.Type;

/** Resolves public document ownership before adapting it to a Next response. */
export const resolvePublicDocumentRoute = Effect.fn(
  "www.routing.publicDocument.resolve"
)(function* (input: PublicDocumentRouteInput) {
  // Flight navigation is resolved by the page itself. Checking the publication
  // here repeats database reads before Next can serve its cached RSC segments.
  // Explicit Markdown keeps its representation resolver, even with RSC headers.
  // HTML keeps the early ownership check so crawlers receive a hard 404.
  if (
    input.isRscRequest &&
    !readLlmsMarkdownPathname(input.pathname).markdownExtension
  ) {
    return { kind: "delegate" } satisfies PublicDocumentRouteDecision;
  }

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
    isRscRequest: input.isRscRequest,
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

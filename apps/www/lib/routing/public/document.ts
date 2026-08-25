import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { Effect, type Option } from "effect";
import {
  type LlmsProxyRouteDecision,
  resolveLlmsProxyRoute,
} from "@/lib/llms/routes";
import { readProjectedHtmlRouteRejection } from "@/lib/routing/public/projected";
import { readSourceBackedHtmlRouteRejection } from "@/lib/routing/public/source";

interface PublicDocumentRouteInput {
  readonly acceptHeader: Option.Option<string>;
  readonly hasAttemptCapability: boolean;
  readonly method: string;
  readonly pathname: string;
}

export type PublicDocumentRouteDecision =
  | LlmsProxyRouteDecision
  | { kind: "not-found"; locale: AppLocaleCode };

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

import "server-only";

import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import {
  PublicContentFailureError,
  PublicContentMissingError,
  PublicContentVerificationError,
} from "@repo/backend/client/content/errors";
import {
  fetchPublicContentRuntime,
  type PublicContentTarget,
} from "@repo/backend/client/content/request";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { verifyContentEnvelope } from "@repo/backend/content/verify";
import { Effect } from "effect";

/** Canonical public identity accepted by signed content readers. */
export interface PublicContentInput {
  readonly locale: ContentLocale;
  readonly publicPath: string;
}

/** Reads and authenticates one exact public content artifact. */
export const readPublicContent = Effect.fn("NakafaContent.readPublicContent")(
  function* (target: PublicContentTarget, input: PublicContentInput) {
    const exchange = yield* fetchPublicContentRuntime(target, {
      delivery: "public",
      locale: input.locale,
      publicPath: input.publicPath,
    });
    const verified = yield* verifyContentEnvelope({
      request: exchange.request,
      response: exchange.response,
    }).pipe(
      Effect.provideService(ContentVerificationKeyResolver, contentKeyResolver),
      Effect.mapError((cause) => new PublicContentVerificationError({ cause }))
    );

    if (verified.kind === "missing") {
      return yield* new PublicContentMissingError(input);
    }
    if (verified.kind === "failure") {
      return yield* new PublicContentFailureError({
        code: verified.code,
        status: exchange.status,
      });
    }

    return verified;
  }
);

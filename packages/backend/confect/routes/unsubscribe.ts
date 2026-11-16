import emails from "@repo/backend/confect/_generated/refs/emails";
import { MutationRunner } from "@repo/backend/confect/_generated/services";
import {
  UNSUBSCRIBE_PARAM,
  UNSUBSCRIBE_POST_PATH,
} from "@repo/backend/confect/emails/unsubscribe/token";
import {
  HTTP_BAD_REQUEST,
  HTTP_OK,
} from "@repo/backend/confect/routes/constants";
import { Effect } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

/**
 * A mail client's one-click unsubscribe (RFC 8058): it posts `List-Unsubscribe=One-Click` to the address in the
 * email's `List-Unsubscribe` header, whose token names the reader, and the route confirms it as the page's press
 * does. A token no Nakafa email carried answers 400.
 */
export const unsubscribeRoutes = HttpRouter.add(
  "POST",
  UNSUBSCRIBE_POST_PATH,
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.toWeb(
      yield* HttpServerRequest.HttpServerRequest
    );
    const token = new URL(request.url).searchParams.get(UNSUBSCRIBE_PARAM);
    const { runMutation } = yield* MutationRunner;
    yield* runMutation(emails.unsubscribe.requests.confirm, {
      token: token ?? "",
    });
    return HttpServerResponse.text("Unsubscribed", { status: HTTP_OK });
  }).pipe(
    Effect.catchTag("UnsubscribeTokenInvalid", () =>
      Effect.succeed(
        HttpServerResponse.text("Bad Request", { status: HTTP_BAD_REQUEST })
      )
    )
  )
);

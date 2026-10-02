import { generateId } from "@repo/backend/confect/utils/id";
import { Context, Effect } from "effect";
import { HttpRouter, HttpServerRequest } from "effect/http";
export class RequestIdentity extends Context.Service<RequestIdentity, string>()(
  "@repo/backend/http/RequestIdentity"
) {}

/** Shares one correlation ID across the request without retaining its URL. */
export const requestIdentity = HttpRouter.middleware<{
  provides: RequestIdentity;
}>()((handler) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const id =
      request.headers["x-request-id"] ?? (yield* Effect.sync(generateId));
    return yield* handler.pipe(Effect.provideService(RequestIdentity, id));
  })
);

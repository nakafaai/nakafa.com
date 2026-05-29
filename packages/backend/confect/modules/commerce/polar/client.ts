import { PolarCore } from "@polar-sh/sdk/core.js";
import {
  readPolarAccessToken,
  readPolarServer,
} from "@repo/backend/confect/modules/commerce/polar/env";
import { Effect } from "effect";

/** Creates a Polar SDK client from the backend config boundary. */
export const makePolarClient = Effect.fnUntraced(function* () {
  const accessToken = yield* readPolarAccessToken();
  const server = yield* readPolarServer();

  return new PolarCore({
    accessToken,
    server,
  });
});

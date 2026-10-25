import { Effect } from "effect";
import { answer } from "@/front/answer";
import type { CasFrontEnv } from "@/front/forward";

/**
 * The fetch handler of the CAS front. Every failure is already a response, so
 * the Effect cannot fail, and the Promise boundary is the Worker's own.
 */
export default {
  fetch(request: Request, env: CasFrontEnv): Promise<Response> {
    return Effect.runPromise(answer(request, env));
  },
};

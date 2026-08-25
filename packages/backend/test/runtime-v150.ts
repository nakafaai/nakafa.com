import { TEST_PUBLIC_KEY } from "@repo/backend/test/content-proof";
import { Effect } from "effect";

/** Loads the immutable Aksara 0.15.0 runtime contract used by predecessors. */
export async function loadRuntimeV150() {
  const [runtime, verification, signature] = await Promise.all([
    import("@nakafa/aksara-v150/runtime/spec"),
    import("@nakafa/aksara-v150/runtime/verify"),
    import("@nakafa/aksara-v150/signature/spec"),
  ]);

  return { runtime, signature, verification };
}

/** Strictly decodes and verifies one exchange with the 0.15.0 archive itself. */
export async function verifyRuntimeV150(request: unknown, response: unknown) {
  const { runtime, signature, verification } = await loadRuntimeV150();
  const decodedRequest = await Effect.runPromise(
    runtime.decodePublicContentRuntimeRequest(request)
  );
  const decodedResponse = await Effect.runPromise(
    runtime.decodePublicContentRuntimeResponse(response)
  );
  const resolver = signature.ContentVerificationKeyResolver.of({
    resolve: () => Effect.succeed(TEST_PUBLIC_KEY),
  });
  const verified = await Effect.runPromise(
    verification
      .verifyContentRuntimeExchange({
        rendererManifest:
          decodedResponse.kind === "found"
            ? decodedResponse.rendererManifest
            : undefined,
        request: decodedRequest,
        response: decodedResponse,
      })
      .pipe(
        Effect.provideService(
          signature.ContentVerificationKeyResolver,
          resolver
        )
      )
  );

  return { request: decodedRequest, response: decodedResponse, verified };
}

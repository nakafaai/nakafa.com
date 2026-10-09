import { ACCOUNT_DELETION_ATTEMPT_HEADER } from "@repo/backend/confect/auth/deletion/constants";
import type { User } from "better-auth";
import { DateTime, Effect } from "effect";

/** The Better Auth user that an account deletion hook receives. */
export function betterAuthUser(id: string, now: number): User {
  return {
    createdAt: DateTime.toDateUtc(DateTime.makeUnsafe(now)),
    email: "deletion-runtime@example.com",
    emailVerified: true,
    id,
    name: "Deletion Runtime",
    updatedAt: DateTime.toDateUtc(DateTime.makeUnsafe(now)),
  };
}

/** The request the browser sends to delete a user, carrying one deletion attempt. */
export function accountDeletionRequest(attemptId: string) {
  return new Request("http://localhost:3000/api/auth/delete-user", {
    headers: {
      [ACCOUNT_DELETION_ATTEMPT_HEADER]: attemptId,
    },
    method: "POST",
  });
}

/** Generates an RSA signing key and returns its public half as a JWK. */
export async function generateSigningPublicKey() {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
    },
    true,
    ["sign", "verify"]
  );
  return crypto.subtle.exportKey("jwk", pair.publicKey);
}

/** Stubs the PostHog erasure configuration that account deletion requires. */
export const withPostHogErasureConfig = Effect.sync(() => {
  vi.stubEnv("POSTHOG_ERASURE_API_KEY", "phx_test_deletion_runtime");
  vi.stubEnv("POSTHOG_HOST", "https://eu.i.posthog.com");
  vi.stubEnv("POSTHOG_PROJECT_ID", "1");
});

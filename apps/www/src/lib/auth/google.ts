import { readAuthClient } from "@/lib/auth/client";
import type { SocialSignInRequest } from "@/lib/auth/social";

/** Invokes the installed Better Auth browser adapter for Google sign-in. */
export const requestGoogleSignIn: SocialSignInRequest = async (input) =>
  await readAuthClient().signIn.social(input);

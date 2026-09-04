"use client";

import { authClient } from "@/lib/auth/client";
import type { SocialSignInRequest } from "@/lib/auth/social";

/** Invokes the installed Better Auth browser adapter for Google sign-in. */
export const requestGoogleSignIn: SocialSignInRequest = async (input) =>
  await authClient.signIn.social(input);

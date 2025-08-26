import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, { userId }) {
      // Automatically generate access token for new users
      await ctx.runMutation(internal.users.ensureAccessToken, { userId });
    },
  },
});

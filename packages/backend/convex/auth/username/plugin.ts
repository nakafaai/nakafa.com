import {
  createUsernameExists,
  resolveUniqueGeneratedUsername,
} from "@repo/backend/convex/auth/username/availability";
import {
  isGeneratedUsername,
  isGoogleCallbackPath,
} from "@repo/backend/convex/auth/username/policy";
import { rejectReservedUsername } from "@repo/backend/convex/auth/username/request";
import { APIError, createAuthMiddleware } from "better-auth/api";
import type { BetterAuthPlugin } from "better-auth/types";
import { Effect } from "effect";

/**
 * Creates the generated username plugin used before Better Auth's username plugin.
 *
 * Sources:
 * - Better Auth plugin hook docs:
 *   https://github.com/better-auth/better-auth/blob/main/docs/content/docs/guides/your-first-plugin.mdx
 * - Installed username plugin source:
 *   better-auth@1.6.12/dist/plugins/username/index.mjs
 */
export function generatedUsername() {
  return {
    id: "generated-username",
    /** Creates adapter-aware hooks after Better Auth has initialized its context. */
    init(ctx) {
      const usernameExists = createUsernameExists(ctx.adapter);

      return {
        options: {
          databaseHooks: {
            user: {
              create: {
                /**
                 * Replaces a generated Google username before Better Auth validates it.
                 *
                 * Source: better-auth@1.6.12/dist/plugins/username/index.mjs
                 */
                async before(user, context) {
                  if (!isGoogleCallbackPath(context?.path)) {
                    return;
                  }

                  if (typeof user.username !== "string") {
                    return;
                  }

                  if (!isGeneratedUsername(user.username)) {
                    return;
                  }

                  if (typeof user.displayUsername !== "string") {
                    return;
                  }

                  const username = await Effect.runPromise(
                    resolveUniqueGeneratedUsername({
                      displayUsername: user.displayUsername,
                      email: user.email,
                      username: user.username,
                      usernameExists,
                    }).pipe(
                      Effect.catchTags({
                        GeneratedUsernameExhaustedError: (error) =>
                          Effect.fail(
                            APIError.from("BAD_REQUEST", {
                              code: "GENERATED_USERNAME_EXHAUSTED",
                              message: error.message,
                            })
                          ),
                        GeneratedUsernameLookupError: (error) =>
                          Effect.fail(
                            APIError.from("INTERNAL_SERVER_ERROR", {
                              code: "GENERATED_USERNAME_LOOKUP_FAILED",
                              message: error.message,
                            })
                          ),
                      })
                    )
                  );

                  if (username === user.username) {
                    return;
                  }

                  return {
                    data: {
                      ...user,
                      username,
                    },
                  };
                },
              },
            },
          },
        },
      };
    },
    hooks: {
      before: [
        {
          /**
           * Matches Better Auth's normalized routes that accept user-provided usernames.
           *
           * Sources:
           * - Better Auth hook matcher docs:
           *   https://github.com/better-auth/better-auth/blob/main/docs/content/docs/guides/your-first-plugin.mdx
           * - Installed endpoint sources:
           *   better-auth@1.6.12/dist/api/routes/sign-up.mjs
           *   better-auth@1.6.12/dist/api/routes/update-user.mjs
           * - Installed username plugin uses the same hook path list:
           *   better-auth@1.6.12/dist/plugins/username/index.mjs
           */
          matcher(context) {
            return (
              context.path === "/sign-up/email" ||
              context.path === "/update-user"
            );
          },
          handler: createAuthMiddleware((ctx) =>
            Effect.runPromise(rejectReservedUsername(ctx.body))
          ),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}

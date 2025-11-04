import type { MiddlewareHandler } from "hono";
import { components } from "../../_generated/api";
import type { ActionCtx } from "../../_generated/server";
import { HTTP_UNAUTHORIZED } from "../constants";

const BEARER_PREFIX = "Bearer ";
const BEARER_PREFIX_LENGTH = BEARER_PREFIX.length;

/**
 * Verify API key and optionally check permissions.
 * Stores userId in context after successful verification.
 *
 * @example
 * // Basic usage
 * app.get("/v1/me", requireApiKey(), (c) => {
 *   const userId = c.get("userId");
 * });
 *
 * @example
 * // With permissions
 * app.delete("/v1/contents/:id",
 *   requireApiKey({ contents: ["delete"] }),
 *   handler
 * );
 */
export const requireApiKey =
  (
    permissions?: Record<string, string[]>
  ): MiddlewareHandler<{
    Bindings: ActionCtx;
    Variables: {
      userId: string;
    };
  }> =>
  async (c, next) => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader?.startsWith(BEARER_PREFIX)) {
      return c.json(
        {
          error: "Missing or invalid Authorization header",
          message: "Use: Authorization: Bearer YOUR_API_KEY",
        },
        HTTP_UNAUTHORIZED
      );
    }

    const apiKey = authHeader.slice(BEARER_PREFIX_LENGTH);

    const result = await c.env.runMutation(
      components.betterAuth.auth.verifyApiKey,
      {
        key: apiKey,
        permissions: permissions ? JSON.stringify(permissions) : undefined,
      }
    );

    if (!(result.valid && result.userId)) {
      return c.json(
        {
          error: result.error?.code ?? "INVALID_API_KEY",
          message: result.error?.message ?? "Invalid API key",
        },
        HTTP_UNAUTHORIZED
      );
    }

    c.set("userId", result.userId);
    await next();
  };

import type { MiddlewareHandler } from "hono";
import { components } from "../../_generated/api";
import type { ActionCtx } from "../../_generated/server";
import { logger } from "../../utils/logger";
import { HTTP_INTERNAL_ERROR, HTTP_UNAUTHORIZED } from "../constants";

const BEARER_PREFIX = "Bearer ";
const BEARER_PREFIX_LENGTH = BEARER_PREFIX.length;

/**
 * Middleware to require a valid API key for protected routes.
 *
 * Verifies the `Authorization: Bearer <token>` header against the database.
 * If valid, adds the `userId` to the context.
 * Optionally checks for specific permissions.
 *
 * @param permissions - Optional map of resource to required permissions (e.g. `{ contents: ["read"] }`)
 * @returns Hono middleware handler
 */
export const requireApiKey =
  (
    permissions?: Record<string, string[]>
  ): MiddlewareHandler<{
    Bindings: ActionCtx;
    Variables: {
      userId: string;
      requestId: string;
    };
  }> =>
  async (c, next) => {
    const requestId = c.get("requestId");
    const authHeader = c.req.header("Authorization");

    if (!authHeader?.startsWith(BEARER_PREFIX)) {
      logger.warn("Auth failed: Missing or invalid Authorization header", {
        requestId,
      });
      return c.json(
        {
          error: "Missing or invalid Authorization header",
          message: "Use: Authorization: Bearer YOUR_API_KEY",
        },
        HTTP_UNAUTHORIZED
      );
    }

    const apiKey = authHeader.slice(BEARER_PREFIX_LENGTH);

    try {
      const result = await c.env.runMutation(
        components.betterAuth.mutations.verifyApiKey,
        {
          key: apiKey,
          permissions: permissions ? JSON.stringify(permissions) : undefined,
        }
      );

      if (!(result.valid && result.userId)) {
        logger.warn(
          `Auth failed: ${result.error?.code ?? "INVALID_API_KEY"} - ${result.error?.message ?? "Invalid API key"}`,
          {
            requestId,
          }
        );
        return c.json(
          {
            error: result.error?.code ?? "INVALID_API_KEY",
            message: result.error?.message ?? "Invalid API key",
          },
          HTTP_UNAUTHORIZED
        );
      }

      c.set("userId", result.userId);
      logger.info("Auth success", {
        requestId,
        userId: result.userId,
      });
      await next();
    } catch (error) {
      logger.error("Auth error", { requestId }, error);
      return c.json(
        {
          error: "INTERNAL_ERROR",
          message: "An error occurred during authentication",
        },
        HTTP_INTERNAL_ERROR
      );
    }
  };

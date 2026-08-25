import {
  createOpenApiOptionsResponse,
  createOpenApiResponse,
} from "@repo/backend/agent/openapi/response";

/** Serves the shared contract locally; Vercel rewrites production to Convex. */
export function GET(request: Request) {
  return createOpenApiResponse(
    request.headers.get("if-none-match") ?? undefined
  );
}

export const HEAD = GET;
export const OPTIONS = createOpenApiOptionsResponse;

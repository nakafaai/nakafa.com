import type { MiddlewareHandler } from "hono";

type RequestLogWriter = (message: string) => void;

/** Logs useful request metadata without retaining query parameters. */
export function createQueryFreeRequestLogger(
  write: RequestLogWriter
): MiddlewareHandler {
  return async (context, next) => {
    const { method, path } = context.req;
    write(`<-- ${method} ${path}`);

    const startedAt = Date.now();
    await next();

    write(
      `--> ${method} ${path} ${context.res.status} ${Date.now() - startedAt}ms`
    );
  };
}

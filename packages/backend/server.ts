import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { corsConfig, swaggerConfig } from "./config";
import { contentsRoute, healthRoute, rootRoute } from "./routes";

export const app = new Elysia()
  .use(cors(corsConfig))
  .use(swagger(swaggerConfig))
  .use(rootRoute)
  .use(healthRoute)
  .use(contentsRoute)
  .onError(({ code, error, set }) => {
    const errorInfo = {
      timestamp: new Date().toISOString(),
      code,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };

    switch (code) {
      case "NOT_FOUND":
        set.status = 404;
        break;
      case "VALIDATION":
        set.status = 400;
        break;
      case "INTERNAL_SERVER_ERROR":
        set.status = 500;
        break;
      default:
        set.status = 500;
    }

    return errorInfo;
  });

export type App = typeof app;

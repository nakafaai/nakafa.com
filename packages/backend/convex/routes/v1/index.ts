import { HTTP_OK } from "@repo/backend/convex/routes/constants";
import { Hono } from "hono";

const v1 = new Hono();

v1.get("/", (c) =>
  c.json(
    {
      version: "1.0.0",
      status: "active",
      docs: "https://docs.nakafa.com/api",
    },
    HTTP_OK
  )
);

v1.get("/health", (c) =>
  c.json(
    {
      status: "ok",
      timestamp: Date.now(),
    },
    HTTP_OK
  )
);

export default v1;

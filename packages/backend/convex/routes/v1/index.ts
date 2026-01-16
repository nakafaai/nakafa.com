import { HTTP_OK } from "@repo/backend/convex/routes/constants";
import { requireApiKey } from "@repo/backend/convex/routes/middleware/auth";
import { Hono } from "hono";

// Create v1 app - all routes here automatically get /v1 prefix
const v1 = new Hono();

// Root - API info
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

// Health check
v1.get("/health", (c) =>
  c.json(
    {
      status: "ok",
      timestamp: Date.now(),
    },
    HTTP_OK
  )
);

// Protected route example
v1.get("/me", requireApiKey(), (c) => {
  const userId = c.get("userId");
  return c.json({ userId });
});

// Add your v1 routes here
//
// Public:
// v1.get("/contents", async (c) => { ... });
//
// Protected:
// v1.post("/messages", requireApiKey(), async (c) => { ... });
//
// With permissions:
// v1.delete("/contents/:id", requireApiKey({ contents: ["delete"] }), async (c) => { ... });

export default v1;

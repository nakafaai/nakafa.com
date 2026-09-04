import { expect, it } from "@effect/vitest";
import { createQueryFreeRequestLogger } from "@repo/backend/convex/routes/middleware/logger";
import { Effect } from "effect";
import { Hono } from "hono";

const completedRequestPattern =
  /^--> GET \/api\/auth\/callback\/google 202 \d+ms$/;

it.effect("logs request paths without OAuth query diagnostics", () =>
  Effect.gen(function* () {
    const messages: string[] = [];
    const app = new Hono();
    app.use(
      "*",
      createQueryFreeRequestLogger((message) => messages.push(message))
    );
    app.get("/api/auth/callback/google", (context) =>
      context.text("Accepted", 202)
    );

    const response = yield* Effect.promise(
      async () =>
        await app.request(
          "http://localhost/api/auth/callback/google?error=access_denied&error_description=private+provider+diagnostic&state=private-state"
        )
    );

    expect(response.status).toBe(202);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toBe("<-- GET /api/auth/callback/google");
    expect(messages[1]).toMatch(completedRequestPattern);
    expect(messages.join("\n")).not.toContain("access_denied");
    expect(messages.join("\n")).not.toContain("error_description");
    expect(messages.join("\n")).not.toContain("private+provider+diagnostic");
    expect(messages.join("\n")).not.toContain("state=");
    expect(messages.join("\n")).not.toContain("private-state");
  })
);

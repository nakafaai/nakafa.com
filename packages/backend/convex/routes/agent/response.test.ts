import { describe, expect, it } from "@effect/vitest";
import {
  agentFailureResponse,
  logInternalFailure,
} from "@repo/backend/convex/routes/agent/response";
import { NakafaAgentInputError } from "@repo/contents/agent/errors";
import { Cause, Effect, Logger } from "effect";

describe("agent responses", () => {
  it("uses corrective input guidance when no cause is supplied", async () => {
    const response = agentFailureResponse(
      new NakafaAgentInputError({ message: "Choose a published locale." }),
      "/search",
      "request-locale"
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      code: "UNPROCESSABLE_REQUEST",
      detail: "Choose a published locale.",
      resolution: "Choose a published locale.",
      request_id: "request-locale",
    });
  });
  it.effect("logs unexpected causes with the public request identity", () =>
    Effect.gen(function* () {
      const entries: Array<{
        readonly annotations: Record<string, unknown>;
        readonly cause: string | undefined;
        readonly level: string;
        readonly message: unknown;
      }> = [];
      const logger = Logger.formatStructured.pipe(
        Logger.map((entry) => entries.push(entry))
      );
      const response = yield* logInternalFailure(
        Cause.die(new Error("private defect detail")),
        "/content",
        "request-123"
      ).pipe(Effect.provide(Logger.layer([logger])));
      const body = yield* Effect.promise(() => response.json());

      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        annotations: {
          instance: "/content",
          requestId: "request-123",
        },
        level: "ERROR",
        message: "Unexpected Nakafa public API failure.",
      });
      expect(entries[0]?.cause).toContain("private defect detail");
      expect(body).toMatchObject({
        code: "INTERNAL_ERROR",
        instance: "/content",
        request_id: "request-123",
        status: 500,
      });
      expect(JSON.stringify(body)).not.toContain("private defect detail");
    })
  );
});

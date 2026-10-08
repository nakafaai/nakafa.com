import { describe, expect, it } from "@effect/vitest";
import {
  agentFailureResponse,
  agentJsonResponse,
  logInternalFailure,
} from "@repo/backend/confect/routes/agent/response";
import { NakafaAgentInputError } from "@repo/contents/agent/errors";
import {
  Array as Arr,
  Cause,
  Effect,
  Logger,
  MutableRef,
  Schema,
} from "effect";

const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

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
  it("sends an empty 200 when the body is undefined", async () => {
    const response = agentJsonResponse(undefined);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });
  it.effect("logs unexpected causes with the public request identity", () =>
    Effect.gen(function* () {
      const logged = MutableRef.make<
        readonly {
          readonly annotations: Record<string, unknown>;
          readonly cause: string | undefined;
          readonly level: string;
          readonly message: unknown;
        }[]
      >([]);
      const logger = Logger.formatStructured.pipe(
        Logger.map((entry) => MutableRef.update(logged, Arr.append(entry)))
      );
      const response = yield* logInternalFailure(
        Cause.die(new Error("private defect detail")),
        "/content",
        "request-123"
      ).pipe(Effect.provide(Logger.layer([logger])));
      const body = yield* Effect.promise(() => response.json());

      const entries = MutableRef.get(logged);
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
      expect(encodeJson(body)).not.toContain("private defect detail");
    })
  );
});

import { describe, expect, it } from "@effect/vitest";
import { NAKAFA_API_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import { runAgentRequest } from "@repo/backend/confect/routes/agent/runtime";
import { Effect, Schema } from "effect";

const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

describe("agent HTTP execution", () => {
  it.effect(
    "sanitizes an unexpected program defect and retains the request identity",
    () =>
      Effect.gen(function* () {
        const response = yield* runAgentRequest(
          new Request(
            `https://origin.example${NAKAFA_API_EDGE_CONTRACT.originPath}${NAKAFA_API_EDGE_CONTRACT.runtimePath}/search`
          ),
          "request-defect",
          Effect.die(new Error("private storage credential"))
        );
        expect(response.status).toBe(500);
        const body = yield* Effect.promise(() => response.json());
        expect(body).toMatchObject({
          code: "INTERNAL_ERROR",
          request_id: "request-defect",
          instance: "/v1/search",
        });
        expect(encodeJson(body)).not.toContain("private storage credential");
      })
  );
});

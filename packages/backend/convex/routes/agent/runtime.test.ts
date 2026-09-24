import { describe, expect, it } from "@effect/vitest";
import { NAKAFA_API_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import { runAgentRequest } from "@repo/backend/convex/routes/agent/runtime";
import { Effect } from "effect";

describe("agent HTTP execution", () => {
  it("sanitizes an unexpected program defect and retains the request identity", async () => {
    const response = await runAgentRequest(
      new Request(
        `https://origin.example${NAKAFA_API_EDGE_CONTRACT.originPath}${NAKAFA_API_EDGE_CONTRACT.runtimePath}/search`
      ),
      "request-defect",
      Effect.die(new Error("private storage credential"))
    );
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({
      code: "INTERNAL_ERROR",
      request_id: "request-defect",
      instance: "/v1/search",
    });
    expect(JSON.stringify(body)).not.toContain("private storage credential");
  });
});

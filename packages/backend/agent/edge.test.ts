import {
  NAKAFA_API_EDGE_CONTRACT,
  projectPublicApiPath,
} from "@repo/backend/agent/edge";
import { describe, expect, it } from "vitest";

describe("agent edge contract", () => {
  it.each([
    ["/openapi.json", "/openapi.json"],
    ["/v1", "/v1"],
    ["/v1/content", "/v1/content"],
  ])("projects the protected origin path for %s", (path, expected) => {
    expect(
      projectPublicApiPath(`${NAKAFA_API_EDGE_CONTRACT.originPath}${path}`)
    ).toBe(expected);
  });
});

import { describe, expect, it } from "@effect/vitest";
import {
  MAX_PUBLIC_RUNTIME_RESPONSE_BYTES,
  PublicContentRuntimeResponseSchema,
} from "@nakafa/aksara-contracts/runtime/spec";
import { encodeRuntimeResult } from "@repo/backend/confect/contentRelease/runtime/result";

describe("contentRelease/runtime/result", () => {
  it("fails closed instead of serializing undeclared private response fields", () => {
    const result = encodeRuntimeResult(
      PublicContentRuntimeResponseSchema,
      MAX_PUBLIC_RUNTIME_RESPONSE_BYTES,
      {
        kind: "missing",
        privateToken: "private-response-detail",
      },
      404
    );
    expect(result).toEqual({
      status: 500,
      body: '{"code":"CONTENT_RUNTIME_INTERNAL","kind":"failure"}',
    });
  });
});

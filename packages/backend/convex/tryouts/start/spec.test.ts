import { assert, it } from "@effect/vitest";
import {
  TryoutStartError,
  toTryoutStartError,
} from "@repo/backend/convex/tryouts/start/spec";
import { ConvexError } from "convex/values";

it("preserves expected start failures while giving unexpected failures a stable code", () => {
  const domain = new TryoutStartError({
    code: "TRYOUT_SECTION_SNAPSHOT_MISMATCH",
    message: "Missing frozen section.",
  });
  assert.strictEqual(toTryoutStartError(domain), domain);
  const convex = toTryoutStartError(
    new ConvexError({
      code: "TRYOUT_SECTION_NOT_FOUND",
      message: "Missing section.",
    })
  );
  assert.instanceOf(convex, TryoutStartError);
  assert.strictEqual(convex.code, "TRYOUT_SECTION_NOT_FOUND");
  assert.strictEqual(convex.message, "Missing section.");
  const unexpected = toTryoutStartError(new Error("Storage unavailable"));
  assert.strictEqual(unexpected.code, "TRYOUT_START_FAILED");
  assert.strictEqual(unexpected.message, "Storage unavailable");
});

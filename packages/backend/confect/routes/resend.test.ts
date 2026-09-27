// @vitest-environment edge-runtime

import { afterEach, describe, expect, it } from "@effect/vitest";
import { resend } from "@repo/backend/confect/emails/client";
import { RESEND_WEBHOOK_PATH } from "@repo/backend/confect/routes/resend";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { Effect } from "effect";

afterEach(() => vi.restoreAllMocks());

describe("Resend webhook route", () => {
  it.effect(
    "delegates the signed event request to component-owned handling",
    () =>
      Effect.gen(function* () {
        const handleWebhook = vi
          .spyOn(resend, "handleResendEventWebhook")
          .mockImplementation(async (_ctx, request) => {
            expect(request.method).toBe("POST");
            expect(new URL(request.url).pathname).toBe(RESEND_WEBHOOK_PATH);
            expect(request.headers.get("svix-id")).toBe("message-id");
            expect(await request.text()).toBe('{"type":"email.delivered"}');
            return new Response(null, { status: 201 });
          });
        const target = yield* Confect.pipe(Effect.provide(confectLayer));
        const response = yield* target.fetch(RESEND_WEBHOOK_PATH, {
          body: '{"type":"email.delivered"}',
          headers: {
            "content-type": "application/json",
            "svix-id": "message-id",
            "svix-signature": "signature",
            "svix-timestamp": "timestamp",
          },
          method: "POST",
        });
        expect(response.status).toBe(201);
        expect(handleWebhook).toHaveBeenCalledOnce();
      })
  );
  it.effect("does not expose the provider endpoint to other methods", () =>
    Effect.gen(function* () {
      const handleWebhook = vi.spyOn(resend, "handleResendEventWebhook");
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      const response = yield* target.fetch(RESEND_WEBHOOK_PATH);
      expect(response.status).toBe(404);
      expect(handleWebhook).not.toHaveBeenCalled();
    })
  );
});

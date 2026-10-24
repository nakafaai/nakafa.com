// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { serveContentPreview } from "@/lib/content/internal/preview.server";
import {
  PreviewEventError,
  PreviewUnavailableError,
} from "@/lib/content/preview/errors";
import { runServerEffect } from "@/lib/server/fn";

const openPreviewEventsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/preview/events", () => ({
  /** Replaces the local preview child with a controlled event source. */
  openPreviewEvents: openPreviewEventsMock,
}));

/** Creates one preview stream request. */
function request() {
  return new Request("https://nakafa.com/api/internal/content/preview");
}

describe("content preview route", () => {
  it("streams the sanitized preview events as server-sent events", async () => {
    openPreviewEventsMock.mockReturnValue(
      Effect.succeed(new ReadableStream<Uint8Array>())
    );

    const response = await runServerEffect(
      serveContentPreview({ request: request() })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/event-stream; charset=utf-8"
    );
    expect(response.headers.get("cache-control")).toBe(
      "private, no-cache, no-store"
    );
    expect(response.headers.get("connection")).toBe("keep-alive");
  });

  it("answers 404 when the preview child is disabled", async () => {
    openPreviewEventsMock.mockReturnValue(
      Effect.fail(new PreviewUnavailableError())
    );

    const response = await runServerEffect(
      serveContentPreview({ request: request() })
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.text()).resolves.toBe("");
  });

  it("answers 502 without details when the provider fails", async () => {
    openPreviewEventsMock.mockReturnValue(
      Effect.fail(new PreviewEventError({ stage: "event" }))
    );

    const response = await runServerEffect(
      serveContentPreview({ request: request() })
    );

    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.text()).resolves.toBe("");
  });
});

// @vitest-environment node

import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/internal/content/preview/route";
import {
  PreviewRequestError,
  PreviewUnavailableError,
} from "@/lib/content/preview/errors";
import { openPreviewEvents } from "@/lib/content/preview/events";

vi.mock("@/lib/content/preview/events", () => ({
  openPreviewEvents: vi.fn(),
}));

const eventsMock = vi.mocked(openPreviewEvents);

/** Runs the framework route boundary with one cancellable request. */
function requestEvents() {
  return GET(new Request("http://localhost/api/internal/content/preview"));
}

beforeEach(() => {
  eventsMock.mockReset();
});

describe("local preview event route", () => {
  it("is unavailable when no development child supplied a provider", async () => {
    eventsMock.mockReturnValueOnce(
      Effect.fail(new PreviewUnavailableError({}))
    );

    const response = await requestEvents();
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("hides provider failures from the browser", async () => {
    eventsMock.mockReturnValueOnce(
      Effect.fail(new PreviewRequestError({ stage: "connect" }))
    );

    const response = await requestEvents();
    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("returns the sanitized stream with private no-cache headers", async () => {
    const source =
      'event: update\ndata: {"format":"aksara-local-preview-v1","revision":1,"status":"ready"}\n\n';
    eventsMock.mockReturnValueOnce(
      Effect.succeed(
        new ReadableStream({
          /** Emits one already sanitized update from the domain seam. */
          start(controller) {
            controller.enqueue(new TextEncoder().encode(source));
            controller.close();
          },
        })
      )
    );

    const response = await requestEvents();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "private, no-cache, no-store"
    );
    expect(response.headers.get("content-type")).toBe(
      "text/event-stream; charset=utf-8"
    );
    await expect(response.text()).resolves.toBe(source);
  });
});

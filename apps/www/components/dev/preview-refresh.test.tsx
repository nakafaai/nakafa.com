import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreviewRefresh } from "@/components/dev/preview-refresh";

const refresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

class PreviewEventSource {
  static current: PreviewEventSource | undefined;

  readonly close = vi.fn();
  readonly url: string;
  private listener: ((event: MessageEvent) => void) | undefined;

  constructor(url: string) {
    this.url = url;
    PreviewEventSource.current = this;
  }

  /** Registers the one update listener used by the preview client. */
  addEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listener = listener;
  }

  /** Removes the listener when React disposes the preview client. */
  removeEventListener(_type: string, listener: (event: MessageEvent) => void) {
    if (this.listener === listener) {
      this.listener = undefined;
    }
  }

  /** Emits one server-sent update to the mounted component. */
  emit(data: string) {
    this.listener?.(new MessageEvent("update", { data }));
  }
}

beforeEach(() => {
  refresh.mockReset();
  PreviewEventSource.current = undefined;
  vi.stubGlobal("EventSource", PreviewEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("preview refresh", () => {
  it("refreshes pending, ready, and failed source transitions", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(<PreviewRefresh />);
    });

    const events = PreviewEventSource.current;
    expect(events?.url).toBe("/api/internal/content/preview");

    for (const [revision, status] of [
      [1, "pending"],
      [2, "ready"],
      [3, "failed"],
    ] as const) {
      events?.emit(
        JSON.stringify({
          format: "aksara-local-preview-v1",
          revision,
          status,
        })
      );
    }

    expect(refresh).toHaveBeenCalledTimes(3);

    events?.emit(JSON.stringify({ status: "ready" }));
    expect(refresh).toHaveBeenCalledTimes(3);

    act(() => {
      root.unmount();
    });
    expect(events?.close).toHaveBeenCalledOnce();

    events?.emit(
      JSON.stringify({
        format: "aksara-local-preview-v1",
        revision: 4,
        status: "ready",
      })
    );
    expect(refresh).toHaveBeenCalledTimes(3);
  });
});

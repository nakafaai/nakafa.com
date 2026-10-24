import { describe, expect, it } from "@effect/vitest";
import { isChatBusy } from "@/components/ai/chat/busy";

const idle = {
  cancelling: false,
  loading: false,
  opening: false,
  pending: false,
  status: "complete",
} as const;

describe("chat/busy", () => {
  it("is idle when nothing is in flight and the turn is settled", () => {
    for (const status of ["complete", "failed", "cancelled"] as const) {
      expect(isChatBusy({ ...idle, status })).toBe(false);
    }
    expect(isChatBusy({ ...idle, status: undefined })).toBe(false);
  });

  it("is busy while a send, retry or stop is in flight", () => {
    expect(isChatBusy({ ...idle, pending: true })).toBe(true);
  });

  it("is busy while the latest turn is queued or running", () => {
    expect(isChatBusy({ ...idle, status: "queued" })).toBe(true);
    expect(isChatBusy({ ...idle, status: "running" })).toBe(true);
  });

  it("is busy while a chat that was just started loads", () => {
    expect(isChatBusy({ ...idle, loading: true, opening: true })).toBe(true);
  });

  it("is not busy for a chat that only loads, or one that was started and has loaded", () => {
    expect(isChatBusy({ ...idle, loading: true })).toBe(false);
    expect(isChatBusy({ ...idle, opening: true })).toBe(false);
  });

  it("ends the work as soon as the learner stops it", () => {
    expect(
      isChatBusy({
        ...idle,
        cancelling: true,
        loading: true,
        opening: true,
        pending: true,
        status: "running",
      })
    ).toBe(false);
  });
});

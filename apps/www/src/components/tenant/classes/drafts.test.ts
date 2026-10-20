import { describe, expect, it } from "@effect/vitest";
import { createChannelDrafts } from "@/components/tenant/classes/drafts";

describe("class channel drafts", () => {
  it("shows a channel while it saves, in the order it was started", () => {
    const drafts = createChannelDrafts();
    drafts.getState().start("Tugas");
    drafts.getState().start("Praktikum");
    expect(drafts.getState().names).toEqual(["Tugas", "Praktikum"]);
  });

  it("removes a channel once the server answered or refused it, and keeps the others", () => {
    const drafts = createChannelDrafts();
    drafts.getState().start("Tugas");
    drafts.getState().start("Praktikum");
    drafts.getState().end("Tugas");
    expect(drafts.getState().names).toEqual(["Praktikum"]);
  });
});

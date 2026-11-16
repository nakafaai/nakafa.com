import { describe, expect, it } from "@effect/vitest";
import { createRoomStore } from "@/components/marketing/school/features/room";

describe("the demo forum's state", () => {
  it("opens the momentum chat first, and marks a chat read once the reader opens it", () => {
    const store = createRoomStore();
    expect(store.getState().channel).toBe("momentum");

    store.getState().open("lab");
    store.getState().open("momentum");
    store.getState().open("lab");

    expect(store.getState().channel).toBe("lab");
    expect(store.getState().opened).toEqual(["momentum", "lab"]);
  });

  it("posts the reader's messages into the chat that stands open, in order", () => {
    const store = createRoomStore();
    store.getState().post("Thanks!");
    store.getState().open("general");
    store.getState().post("photo.png");

    expect(store.getState().posted).toEqual([
      { channel: "momentum", key: "0", text: "Thanks!" },
      { channel: "general", key: "1", text: "photo.png" },
    ]);
  });

  it("keeps what the reader searches the chats for", () => {
    const store = createRoomStore();
    store.getState().search("lab");

    expect(store.getState().query).toBe("lab");
  });
});

import { expect, it } from "@effect/vitest";
import { readComposerSubmit } from "@/components/ai/chat/submit";

const idle = {
  busy: false,
  hasText: true,
  loading: false,
  pending: false,
  signedIn: true,
  userPending: false,
};

it("sends a message from a signed-in learner", () => {
  expect(readComposerSubmit(idle)).toBe("send");
});

it("sends a signed-out learner to sign in and keeps the message", () => {
  expect(readComposerSubmit({ ...idle, signedIn: false })).toBe("sign-in");
});

it("keeps what the learner typed while Nina answers, and never stops the answer", () => {
  expect(readComposerSubmit({ ...idle, busy: true })).toBe("keep");
});

it("keeps the message while the chat loads, a send is in flight or the viewer is still loading", () => {
  expect(readComposerSubmit({ ...idle, loading: true })).toBe("keep");
  expect(readComposerSubmit({ ...idle, pending: true })).toBe("keep");
  expect(readComposerSubmit({ ...idle, userPending: true })).toBe("keep");
});

it("keeps an empty message", () => {
  expect(readComposerSubmit({ ...idle, hasText: false })).toBe("keep");
});

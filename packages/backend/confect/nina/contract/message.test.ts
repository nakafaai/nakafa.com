import { vMessageStatus, vStreamMessage } from "@convex-dev/agent/validators";
import { describe, expect, it } from "@effect/vitest";
import { MessagePage } from "@repo/backend/confect/nina/contract/message";
import { Array as Arr } from "effect";

// The fields of one message of a page, and of one stream that a page lists.
const message = MessagePage.fields.page.schema.value.fields;
const [listing] = MessagePage.fields.streams.members;
const stream = listing.fields.messages.schema.value.fields;

describe("Nina message vocabulary", () => {
  it("matches the values that the Agent component validates, in their order", () => {
    expect(message.status.literals).toEqual([
      "streaming",
      ...Arr.map(vMessageStatus.members, (status) => status.value),
    ]);
    expect(stream.status.literals).toEqual(
      Arr.map(vStreamMessage.fields.status.members, (status) => status.value)
    );
    expect(stream.format.schema.members[0].literals).toEqual(
      Arr.map(vStreamMessage.fields.format.members, (format) => format.value)
    );
  });
});

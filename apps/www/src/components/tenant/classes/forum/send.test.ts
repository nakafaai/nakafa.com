import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Exit, Option, Result, Schema } from "effect";
import type { ForumMessage } from "@/components/tenant/classes/forum/optimistic";
import { sendMessage } from "@/components/tenant/classes/forum/send";

const slug = Schema.decodeSync(TenantSlug)("sekolah");
const classId = Schema.decodeUnknownSync(Id("classes"))("class-1");
const channelId = Schema.decodeUnknownSync(Id("classroomChannels"))("general");
const author = {
  id: Schema.decodeUnknownSync(Id("tenantPeople"))("person-1"),
  name: "Bu Rina",
};
const args = {
  channelId,
  classId,
  clientKey: "0b5c9d1e-4f3a-4c2b-9a8d-7e6f5a4b3c2d",
  slug,
  text: "Tugas dikumpulkan Jumat.",
};

/** The message the server answers with, under the ID it gave. */
const stored: ForumMessage = {
  author,
  clientKey: args.clientKey,
  createdAt: 1000,
  editedAt: null,
  id: Schema.decodeUnknownSync(Id("classroomMessages"))("message-1"),
  mine: true,
  text: args.text,
};

describe("sendMessage", () => {
  it.effect(
    "sends the message with an update that shows it at once under its client key, and answers the stored message",
    () =>
      Effect.gen(function* () {
        const send = vi.fn((_update: unknown, sent: typeof args) =>
          Promise.resolve(Result.succeed({ ...stored, text: sent.text }))
        );

        const answer = yield* sendMessage(send, author, args);

        expect(answer).toEqual(stored);
        expect(send).toHaveBeenCalledWith(expect.any(Function), args);

        // The update shows the message first in the channel's newest page, under its client key
        // and at the time of the send, which the test clock holds at zero.
        const setQuery = vi.fn();
        const update = send.mock.calls[0]?.[0];
        expect(update).toBeTypeOf("function");
        if (typeof update === "function") {
          update(
            {
              getAllQueries: () => [
                {
                  args: { channelId, paginationOpts: { cursor: null } },
                  value: Option.some({ isDone: true, page: [] }),
                },
              ],
              setQuery,
            },
            args
          );
        }
        expect(setQuery.mock.calls[0]?.[2]).toEqual(
          Option.some({
            isDone: true,
            page: [
              {
                ...stored,
                createdAt: 0,
                id: args.clientKey,
              },
            ],
          })
        );
      })
  );

  it.effect("fails with the refusal the server answers", () =>
    Effect.gen(function* () {
      const send = () => Promise.resolve(Result.fail("refused"));

      const exit = yield* Effect.exit(sendMessage(send, author, args));

      expect(Exit.isFailure(exit)).toBe(true);
    })
  );
});

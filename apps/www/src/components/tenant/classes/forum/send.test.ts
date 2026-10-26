import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Exit, Option, Result, Schema } from "effect";
import type { ForumMessage } from "@/components/tenant/classes/forum/optimistic";
import {
  openDiscussion,
  sendMessage,
  sendReply,
} from "@/components/tenant/classes/forum/send";

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
  discussion: null,
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

/** Runs the optimistic update a mutation was given against a store that answers `queries`, and returns what it wrote. */
const applyUpdate = (
  update: unknown,
  ref: unknown,
  queries: readonly unknown[],
  updateArgs: unknown
) => {
  const setQuery = vi.fn();
  if (typeof update === "function") {
    update(
      {
        getAllQueries: (asked: unknown) => (asked === ref ? queries : []),
        setQuery,
      },
      updateArgs
    );
  }
  return setQuery;
};

describe("sendReply and openDiscussion", () => {
  it.effect(
    "reply under the client key at once, and open a discussion whose message shows its title at once",
    () =>
      Effect.gen(function* () {
        const reply = vi.fn((_update: unknown, _args: unknown) =>
          Promise.resolve(Result.succeed(stored))
        );
        const replyArgs = {
          classId,
          clientKey: args.clientKey,
          number: 3,
          slug,
          text: args.text,
        };
        expect(yield* sendReply(reply, author, replyArgs)).toEqual(stored);
        const replied = applyUpdate(
          reply.mock.calls[0]?.[0],
          classroom.forum.threads.replies,
          [
            {
              args: { number: 3, paginationOpts: { cursor: null } },
              value: Option.some({ isDone: true, page: [] }),
            },
          ],
          replyArgs
        );
        expect(replied.mock.calls[0]?.[2]).toEqual(
          Option.some({
            isDone: true,
            page: [{ ...stored, createdAt: 0, id: args.clientKey }],
          })
        );

        const open = vi.fn((_update: unknown, _args: unknown) =>
          Promise.resolve(Result.succeed("opened"))
        );
        const openArgs = { ...args, title: "Gaya gesek" };
        expect(yield* openDiscussion(open, author, openArgs)).toBe("opened");
        const opened = applyUpdate(
          open.mock.calls[0]?.[0],
          classroom.forum.messages.page,
          [
            {
              args: { channelId, paginationOpts: { cursor: null } },
              value: Option.some({ isDone: true, page: [] }),
            },
          ],
          openArgs
        );
        expect(opened.mock.calls[0]?.[2]).toEqual(
          Option.some({
            isDone: true,
            page: [
              {
                ...stored,
                createdAt: 0,
                discussion: {
                  lastReplyAt: null,
                  number: 1,
                  replies: 0,
                  title: "Gaya gesek",
                  unread: false,
                },
                id: args.clientKey,
              },
            ],
          })
        );
      })
  );
});

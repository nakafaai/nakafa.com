import type { OptimisticUpdate } from "@confect/react";
import nina from "@repo/backend/confect/_generated/refs/nina";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { FileUIPart } from "ai";
import { Array as Arr, HashMap, Option } from "effect";

/**
 * Adds the sent prompt to the first page of the chat's loaded messages, so it
 * shows at once. Confect replays this callback on every change of the loaded
 * data until the authoritative message arrives, so it only reads the store and
 * writes new pages. Dropping it brings back exactly the pages it read.
 */
export function optimisticPrompt(
  previews: HashMap.HashMap<Id<"ninaUploads">, FileUIPart>,
  createdAt: number
): OptimisticUpdate<typeof nina.turns.start> {
  return (store, args) => {
    if (!args.chatId) {
      return;
    }
    const conversation = store.getQuery(nina.conversation.get, {
      chatId: args.chatId,
    });
    if (Option.isNone(conversation)) {
      return;
    }
    const threadId = conversation.value.chat.threadId;
    const pages = Arr.filter(
      store.getAllQueries(nina.messages.list),
      (page) =>
        page.args.chatId === args.chatId &&
        page.args.threadId === threadId &&
        !page.args.streamArgs
    );
    const messages = Arr.flatMap(pages, (page) =>
      Option.isSome(page.value) ? page.value.value.page : []
    );
    const order =
      1 + Math.max(-1, ...Arr.map(messages, (message) => message.order));
    const input = args.input;
    const prompt: Option.Option<
      Pick<(typeof messages)[number], "parts" | "text">
    > =
      input.kind === "message"
        ? Option.some({
            text: input.prompt.text,
            parts: [
              { type: "text", text: input.prompt.text },
              ...Arr.flatMap(input.prompt.uploadIds ?? [], (id) => {
                const file = Option.getOrUndefined(HashMap.get(previews, id));
                return file ? [file] : [];
              }),
            ],
          })
        : Arr.findFirst(
            messages,
            (message) =>
              message.order === input.order && message.role === "user"
          );
    if (Option.isNone(prompt)) {
      return;
    }
    const { text, parts } = prompt.value;
    for (const page of pages) {
      if (
        page.args.paginationOpts.cursor !== null ||
        Option.isNone(page.value)
      ) {
        continue;
      }
      store.setQuery(
        nina.messages.list,
        page.args,
        Option.some({
          ...page.value.value,
          page: [
            {
              id: args.requestId,
              key: `${threadId}-${order}-0`,
              order,
              stepOrder: 0,
              status: "pending",
              role: "user",
              text,
              parts,
              _creationTime: createdAt,
            },
            ...page.value.value.page,
          ],
        })
      );
    }
  };
}

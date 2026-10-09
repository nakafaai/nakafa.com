"use client";

import { useMutation } from "@confect/react";
import type * as OptimisticLocalStore from "@confect/react/OptimisticLocalStore";
import chats from "@repo/backend/confect/_generated/refs/chats";
import nina from "@repo/backend/confect/_generated/refs/nina";
import type { ChatVisibility } from "@repo/backend/confect/chats/schema";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Option } from "effect";
import {
  patchChatPage,
  removeChatFromPage,
  updateOwnChatVisibility,
} from "@/components/ai/chat/state";

/** Patch a loaded chat detail projection when it is subscribed. */
function patchChatDetail(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  chatId: Id<"chats">,
  patch: {
    title?: string;
    visibility?: ChatVisibility;
  }
) {
  const conversation = localStore.getQuery(nina.conversation.get, {
    chatId,
  });
  if (Option.isSome(conversation)) {
    localStore.setQuery(
      nina.conversation.get,
      { chatId },
      Option.some({
        ...conversation.value,
        chat: { ...conversation.value.chat, ...patch },
      })
    );
  }
  const chat = Option.getOrUndefined(
    localStore.getQuery(chats.queries.getChat, {
      chatId,
    })
  );
  if (chat) {
    localStore.setQuery(
      chats.queries.getChat,
      {
        chatId,
      },
      Option.some({
        ...chat,
        ...patch,
      })
    );
  }
}

/** Patch or remove a chat across every loaded visibility-aware list. */
function patchLoadedLists(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  chatId: Id<"chats">,
  patch: {
    title?: string;
    visibility?: ChatVisibility;
  }
) {
  for (const query of localStore.getAllQueries(chats.queries.getOwnChats)) {
    if (Option.isNone(query.value)) {
      continue;
    }
    const page = patch.visibility
      ? updateOwnChatVisibility(
          query.value.value.page,
          chatId,
          patch.visibility,
          query.args.visibility
        )
      : patchChatPage(query.value.value.page, chatId, patch);
    localStore.setQuery(
      chats.queries.getOwnChats,
      query.args,
      Option.some({
        ...query.value.value,
        page,
      })
    );
  }
  for (const query of localStore.getAllQueries(chats.queries.getChats)) {
    if (Option.isNone(query.value)) {
      continue;
    }
    const page =
      patch.visibility === "private"
        ? removeChatFromPage(query.value.value.page, chatId)
        : patchChatPage(query.value.value.page, chatId, patch);
    localStore.setQuery(
      chats.queries.getChats,
      query.args,
      Option.some({
        ...query.value.value,
        page,
      })
    );
  }
}

/** Remove one chat from every loaded owned and public list. */
function removeFromLoadedLists(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  chatId: Id<"chats">
) {
  for (const query of localStore.getAllQueries(chats.queries.getOwnChats)) {
    if (Option.isSome(query.value)) {
      localStore.setQuery(
        chats.queries.getOwnChats,
        query.args,
        Option.some({
          ...query.value.value,
          page: removeChatFromPage(query.value.value.page, chatId),
        })
      );
    }
  }
  for (const query of localStore.getAllQueries(chats.queries.getChats)) {
    if (Option.isSome(query.value)) {
      localStore.setQuery(
        chats.queries.getChats,
        query.args,
        Option.some({
          ...query.value.value,
          page: removeChatFromPage(query.value.value.page, chatId),
        })
      );
    }
  }
}

/** Return a title mutation that updates every loaded chat projection. */
export function useUpdateChatTitleMutation() {
  return useMutation(chats.mutations.updateChatTitle).withOptimisticUpdate(
    (localStore, { chatId, title }) => {
      patchChatDetail(localStore, chatId, {
        title,
      });
      patchLoadedLists(localStore, chatId, {
        title,
      });
      const currentTitle = Option.getOrUndefined(
        localStore.getQuery(chats.queries.getChatTitle, {
          chatId,
        })
      );
      if (currentTitle !== undefined) {
        localStore.setQuery(
          chats.queries.getChatTitle,
          {
            chatId,
          },
          Option.some(title)
        );
      }
    }
  );
}

/** Return a visibility mutation that updates eligible loaded chat projections. */
export function useUpdateChatVisibilityMutation() {
  return useMutation(chats.mutations.updateChatVisibility).withOptimisticUpdate(
    (localStore, { chatId, visibility }) => {
      patchChatDetail(localStore, chatId, {
        visibility,
      });
      patchLoadedLists(localStore, chatId, {
        visibility,
      });
    }
  );
}

/** Return a delete mutation that removes the chat from every loaded list. */
export function useDeleteChatMutation() {
  return useMutation(chats.mutations.deleteChat).withOptimisticUpdate(
    (localStore, { chatId }) => {
      removeFromLoadedLists(localStore, chatId);
    }
  );
}

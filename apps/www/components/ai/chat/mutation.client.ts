"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { OptimisticLocalStore } from "convex/browser";
import { useMutation } from "convex/react";
import {
  patchChatPage,
  removeChatFromPage,
  updateOwnChatVisibility,
} from "@/components/ai/chat/state";

function patchChatDetail(
  localStore: OptimisticLocalStore,
  chatId: Id<"chats">,
  patch: { title?: string; visibility?: "private" | "public" }
) {
  const chat = localStore.getQuery(api.chats.queries.getChat, { chatId });
  if (chat) {
    localStore.setQuery(
      api.chats.queries.getChat,
      { chatId },
      {
        ...chat,
        ...patch,
      }
    );
  }
}

function patchLoadedLists(
  localStore: OptimisticLocalStore,
  chatId: Id<"chats">,
  patch: { title?: string; visibility?: "private" | "public" }
) {
  for (const query of localStore.getAllQueries(api.chats.queries.getOwnChats)) {
    if (!query.value) {
      continue;
    }

    const page = patch.visibility
      ? updateOwnChatVisibility(
          query.value.page,
          chatId,
          patch.visibility,
          query.args.visibility
        )
      : patchChatPage(query.value.page, chatId, patch);
    localStore.setQuery(api.chats.queries.getOwnChats, query.args, {
      ...query.value,
      page,
    });
  }

  for (const query of localStore.getAllQueries(api.chats.queries.getChats)) {
    if (!query.value) {
      continue;
    }

    const page =
      patch.visibility === "private"
        ? removeChatFromPage(query.value.page, chatId)
        : patchChatPage(query.value.page, chatId, patch);
    localStore.setQuery(api.chats.queries.getChats, query.args, {
      ...query.value,
      page,
    });
  }
}

function removeFromLoadedLists(
  localStore: OptimisticLocalStore,
  chatId: Id<"chats">
) {
  for (const query of localStore.getAllQueries(api.chats.queries.getOwnChats)) {
    if (query.value) {
      localStore.setQuery(api.chats.queries.getOwnChats, query.args, {
        ...query.value,
        page: removeChatFromPage(query.value.page, chatId),
      });
    }
  }

  for (const query of localStore.getAllQueries(api.chats.queries.getChats)) {
    if (query.value) {
      localStore.setQuery(api.chats.queries.getChats, query.args, {
        ...query.value,
        page: removeChatFromPage(query.value.page, chatId),
      });
    }
  }
}

/** Return a title mutation that updates every loaded chat projection. */
export function useUpdateChatTitleMutation() {
  return useMutation(api.chats.mutations.updateChatTitle).withOptimisticUpdate(
    (localStore, { chatId, title }) => {
      patchChatDetail(localStore, chatId, { title });
      patchLoadedLists(localStore, chatId, { title });

      const currentTitle = localStore.getQuery(api.chats.queries.getChatTitle, {
        chatId,
      });
      if (currentTitle !== undefined) {
        localStore.setQuery(api.chats.queries.getChatTitle, { chatId }, title);
      }
    }
  );
}

/** Return a visibility mutation that updates eligible loaded chat projections. */
export function useUpdateChatVisibilityMutation() {
  return useMutation(
    api.chats.mutations.updateChatVisibility
  ).withOptimisticUpdate((localStore, { chatId, visibility }) => {
    patchChatDetail(localStore, chatId, { visibility });
    patchLoadedLists(localStore, chatId, { visibility });
  });
}

/** Return a delete mutation that removes the chat from every loaded list. */
export function useDeleteChatMutation() {
  return useMutation(api.chats.mutations.deleteChat).withOptimisticUpdate(
    (localStore, { chatId }) => {
      removeFromLoadedLists(localStore, chatId);
    }
  );
}

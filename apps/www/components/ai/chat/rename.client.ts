"use client";

import type { ChatView } from "@repo/backend/confect/chats/view";
import { focusIsLost } from "@repo/design-system/lib/focus";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { useChange } from "@/components/ai/chat/change.client";
import { useUpdateChatTitleMutation } from "@/components/ai/chat/mutation.client";
import { reportClientException } from "@/lib/analytics/client";

/**
 * Gives the focus to the control that opened the box, or to the title when that
 * control is gone. The focus moves only while it is still lost, so a control the
 * learner chose keeps it.
 */
function returnFocus(
  box: HTMLElement | null,
  opener: HTMLElement | null,
  title: HTMLElement | null
) {
  if (focusIsLost(box)) {
    (opener ?? title)?.focus();
  }
}

/**
 * The rename of a chat's title in its header: the box that replaces the title
 * while the learner edits it, the focus that moves into and out of the box, and
 * the save that sends the new title.
 */
export function useChatRename(chat: ChatView) {
  const tCommon = useTranslations("Common");
  const actionErrorMessage = tCommon("action-error");
  const [isEditing, setIsEditing] = useState(false);
  const [chatTitle, setChatTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const moreActions = useRef<HTMLButtonElement>(null);
  const titleElement = useRef<HTMLHeadingElement | null>(null);
  // The box of the rename that was sent. It has left the page with the focus.
  const sentBox = useRef<HTMLInputElement | null>(null);
  // Set when a rename lands, until the focus has gone back to the menu.
  const landed = useRef(false);
  const updateChatTitle = useUpdateChatTitleMutation();
  const { change, isPending } = useChange();

  /**
   * This ref runs in the commit that ends a rename, which is the commit that
   * enables the menu again. The rename's completion runs before that commit, and
   * the menu is still disabled then, so the focus waits for this ref. When the
   * menu is gone, the title takes the focus.
   */
  const titleRef = useCallback(
    (element: HTMLHeadingElement | null) => {
      titleElement.current = element;
      if (element && !isPending && landed.current) {
        landed.current = false;
        returnFocus(sentBox.current, moreActions.current, element);
      }
    },
    [isPending]
  );

  /**
   * Opens the box with the current title, and focuses it once it is in the page.
   * The menu item that calls this closes the menu after it, and the menu leaves
   * the focus where the box put it.
   */
  const handleEdit = () => {
    flushSync(() => {
      setChatTitle(chat.title ?? "");
      setIsEditing(true);
    });
    inputRef.current?.focus();
  };

  /** Closes the box and returns the focus to the control that opened it, or to the title. */
  const closeEditor = () => {
    const box = inputRef.current;
    flushSync(() => setIsEditing(false));
    returnFocus(box, moreActions.current, titleElement.current);
  };

  /** Persist a non-empty edited chat title. */
  const handleSave = () => {
    const nextTitle = chatTitle.trim();
    if (!nextTitle || isPending) {
      return;
    }
    // The box leaves the page now. The focus goes back once the rename settles.
    sentBox.current = inputRef.current;
    setIsEditing(false);
    change(() =>
      Effect.runPromise(
        Effect.tryPromise(() =>
          updateChatTitle({
            chatId: chat._id,
            title: nextTitle,
          })
        ).pipe(
          Effect.flatMap(Effect.fromResult),
          Effect.matchEffect({
            onSuccess: () =>
              Effect.sync(() => {
                landed.current = true;
              }),
            onFailure: (error) =>
              reportClientException(error, {
                source: "components/ai/chat/rename",
              }).pipe(
                Effect.andThen(
                  Effect.sync(() => {
                    // The box comes back with the words the learner wrote. It
                    // takes the focus unless a control the learner chose has it.
                    flushSync(() => setIsEditing(true));
                    if (focusIsLost(sentBox.current)) {
                      inputRef.current?.focus();
                    }
                    toast.error(actionErrorMessage);
                  })
                )
              ),
          })
        )
      )
    );
  };

  return {
    chatTitle,
    closeEditor,
    handleEdit,
    handleSave,
    inputRef,
    isEditing,
    isPending,
    moreActions,
    setChatTitle,
    titleRef,
  };
}

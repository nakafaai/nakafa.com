"use client";

import type { ChatView } from "@repo/backend/confect/chats/view";
import { focusIsLost } from "@repo/design-system/lib/focus";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
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
  // Set by the rename item. The chat's menu then hands the focus to the box when it closes.
  const [menuReturnsToBox, setMenuReturnsToBox] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const moreActions = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const updateChatTitle = useUpdateChatTitleMutation();

  /**
   * Opens the box with the current title. The menu item that calls this closes
   * the menu after it, and the menu gives the focus to the box once it has closed.
   */
  const handleEdit = () => {
    flushSync(() => {
      setMenuReturnsToBox(true);
      setChatTitle(chat.title ?? "");
      setIsEditing(true);
    });
  };

  /**
   * Opening the menu ends the hand-off of the last rename, so the menu's next
   * close returns the focus to its trigger.
   */
  const onMenuOpenChange = (open: boolean) => {
    if (open) {
      setMenuReturnsToBox(false);
    }
  };

  /** Closes the box and returns the focus to the control that opened it, or to the title. */
  const closeEditor = () => {
    const box = inputRef.current;
    flushSync(() => setIsEditing(false));
    returnFocus(box, moreActions.current, titleRef.current);
  };

  /**
   * Persist a non-empty edited chat title. The box closes at once, so the focus
   * goes back to the chat's menu before the server answers.
   */
  const handleSave = () => {
    const nextTitle = chatTitle.trim();
    if (!nextTitle) {
      return;
    }
    closeEditor();
    if (nextTitle === chat.title) {
      return;
    }
    Effect.runFork(
      Effect.tryPromise(() =>
        updateChatTitle({
          chatId: chat._id,
          title: nextTitle,
        })
      ).pipe(
        Effect.flatMap(Effect.fromResult),
        Effect.matchEffect({
          onSuccess: () => Effect.void,
          onFailure: (error) =>
            reportClientException(error, {
              source: "components/ai/chat/rename",
            }).pipe(
              Effect.andThen(
                Effect.sync(() => {
                  // The box comes back with the words the learner wrote. It takes the
                  // focus unless a control the learner chose has it. The menu that the
                  // save gave the focus back to is not such a control.
                  const box = inputRef.current;
                  flushSync(() => setIsEditing(true));
                  if (
                    focusIsLost(box) ||
                    document.activeElement === moreActions.current
                  ) {
                    box?.focus();
                  }
                  toast.error(actionErrorMessage);
                })
              )
            ),
        })
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
    menuFinalFocus: menuReturnsToBox ? inputRef : undefined,
    moreActions,
    onMenuOpenChange,
    setChatTitle,
    titleRef,
  };
}

"use client";

import type { ChatView } from "@repo/backend/confect/chats/view";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect } from "effect";
import { useLayoutEffect, useRef, useState } from "react";
import { useUpdateChatTitleMutation } from "@/components/ai/chat/mutation";
import {
  focusBoxAfterRefusal,
  returnFocusAfterClose,
} from "@/components/ai/chat/rename";
import { reportClientException } from "@/lib/analytics/client";

/**
 * The rename of a chat's title in its header: the box that replaces the title
 * while the learner edits it, the focus that moves into and out of the box, and
 * the save that sends the new title.
 */
export function useChatRename(chat: ChatView) {
  const [isEditing, setIsEditing] = useState(false);
  const [chatTitle, setChatTitle] = useState("");
  // Set by the rename item. The chat's menu then hands the focus to the box when it closes.
  const [menuReturnsToBox, setMenuReturnsToBox] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const moreActions = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  // The number of the latest save sent. A refusal of an older save brings nothing
  // back, because a newer save holds the learner's words.
  const latestSave = useRef(0);
  // The focus that an event asks for. Each request is a new value, so the commit
  // that follows it always runs the request.
  const [focusStep, setFocusStep] = useState<{ focus: () => void } | null>(
    null
  );
  const updateChatTitle = useUpdateChatTitleMutation();

  // The box shows or hides in the commit that follows an event, and the focus
  // moves only after that commit: the control that held the focus can be the
  // one the commit removes, and a hidden box has no ref until it shows again.
  useLayoutEffect(() => {
    focusStep?.focus();
  }, [focusStep]);

  /**
   * Opens the box with the current title. The menu item that calls this closes
   * the menu after it, and the menu gives the focus to the box once it has closed.
   */
  const handleEdit = () => {
    setMenuReturnsToBox(true);
    setChatTitle(chat.title ?? "");
    setIsEditing(true);
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
    setFocusStep({
      focus: () =>
        returnFocusAfterClose(box, moreActions.current, titleRef.current),
    });
    setIsEditing(false);
  };

  /**
   * Persist a non-empty edited chat title. The box closes at once, so the focus
   * goes back to the chat's menu before the server answers. A refusal brings the
   * box back only while no newer save has been sent.
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
    const saveNumber = latestSave.current + 1;
    latestSave.current = saveNumber;
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
                  // A newer save holds the learner's words now, so this refusal only
                  // reports. The box and the focus stay where that save left them.
                  if (latestSave.current !== saveNumber) {
                    return;
                  }
                  // The box comes back with the words the learner wrote, and the
                  // focus moves to it once the commit has shown it.
                  setFocusStep({
                    focus: () =>
                      focusBoxAfterRefusal(
                        inputRef.current,
                        moreActions.current
                      ),
                  });
                  setIsEditing(true);
                  toast.error({
                    description: "action-error.description",
                    title: "action-error.title",
                  });
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

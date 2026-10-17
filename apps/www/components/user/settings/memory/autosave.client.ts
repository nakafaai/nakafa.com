"use client";

import { useCallbackRef, useDebouncedCallback } from "@mantine/hooks";
import { Duration } from "effect";
import { useEffect, useState } from "react";
import { useMemoryActions } from "@/components/user/settings/memory/actions.client";
import { createAutosave } from "@/components/user/settings/memory/autosave";
import type {
  Memory,
  MemoryDraft,
} from "@/components/user/settings/memory/list";
import {
  useMemoryLatest,
  useMemoryPage,
} from "@/components/user/settings/memory/provider";

/** How long the editor waits after the last keystroke before it saves. */
const PAUSE = Duration.millis(600);
/** The longest the editor goes without saving while the learner keeps writing. */
const LONGEST = Duration.seconds(3);

/**
 * Saves what the learner writes in one opening of the editor, with no button:
 * a moment after they stop writing, and at once when the editor closes. A save
 * that fails tells the learner and is tried again with the next change. When
 * the editor is closed by then, it opens again with what they wrote. A save
 * that finds the memory gone closes the editor. A stored memory the learner
 * emptied keeps the words the server holds when the editor closes.
 *
 * `restored` is the words of a save that failed, when the editor opens again
 * with them, and `starting` is the words the editor opens with. `change` takes
 * what the editor holds now. `discard` stops the saving and deletes the memory.
 */
export function useAutosave(
  memory: Memory | null,
  restored: MemoryDraft | null
) {
  const { add, edit, remove } = useMemoryActions();
  const adopt = useMemoryPage((state) => state.adopt);
  const hide = useMemoryPage((state) => state.hide);
  const leave = useMemoryPage((state) => state.leave);
  const reopen = useMemoryPage((state) => state.reopen);
  const session = useMemoryPage((state) => state.session);
  const unhide = useMemoryPage((state) => state.unhide);
  const latest = useMemoryLatest();
  const [saving] = useState(() => createAutosave(memory, restored));
  const send = {
    add,
    adopt: (stored: Memory) => adopt(session, stored),
    cleared: () => latest().cleared,
    edit,
    hide,
    leave: () => leave(session),
    remove,
    // The editor holds the memory it opened, which follows what it saved.
    reopen: (draft: MemoryDraft) => reopen(session, draft, latest().target),
    unhide,
  };
  const write = useCallbackRef(() => saving.write(send));
  const later = useDebouncedCallback(write, {
    delay: Duration.toMillis(PAUSE),
    maxWait: Duration.toMillis(LONGEST),
  });
  const finish = useCallbackRef(() => {
    later.cancel();
    saving.close(send);
  });

  // The editor closes: what the server does not have yet goes out now.
  useEffect(() => finish, [finish]);

  function change(draft: MemoryDraft) {
    saving.change(draft);
    later();
  }

  function discard() {
    later.cancel();
    saving.discard(send, memory);
  }

  return { change, discard, starting: saving.starting };
}

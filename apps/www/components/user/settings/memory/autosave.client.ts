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
import { useMemoryPage } from "@/components/user/settings/memory/provider";

/** How long the editor waits after the last keystroke before it saves. */
const PAUSE = Duration.millis(600);
/** The longest the editor goes without saving while the learner keeps writing. */
const LONGEST = Duration.seconds(3);

/**
 * Saves what the learner writes in one opening of the editor, with no button:
 * a moment after they stop writing, and at once when the editor closes. A save
 * that fails tells the learner and is tried again with the next change.
 *
 * `change` takes what the editor holds now. `discard` stops the saving and
 * deletes the memory, with an Undo when the learner had seen it stored.
 */
export function useAutosave(memory: Memory | undefined, starting: MemoryDraft) {
  const { add, drop, edit, remove } = useMemoryActions();
  const adopt = useMemoryPage((state) => state.adopt);
  const session = useMemoryPage((state) => state.session);
  const [saving] = useState(() => createAutosave(memory, starting));
  const send = {
    add,
    adopt: (id: Memory["id"]) => adopt(session, id),
    drop,
    edit,
    remove,
  };
  const write = useCallbackRef(() => saving.write(send));
  const later = useDebouncedCallback(write, {
    delay: Duration.toMillis(PAUSE),
    maxWait: Duration.toMillis(LONGEST),
  });
  const finish = useCallbackRef(() => {
    later.cancel();
    write();
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

  return { change, discard };
}

"use client";

import { ChatComposer } from "@/components/ai/chat/composer";
import { NinaTranscript } from "@/components/ai/transcript";

/** Renders messages and the active chat input inside Nina sheet. */
export function SheetMain() {
  return (
    <div className="relative flex size-full min-w-0 flex-col overflow-hidden text-chat">
      <NinaTranscript />

      <div className="grid shrink-0 px-2 pb-2">
        <ChatComposer autoFocus />
      </div>
    </div>
  );
}

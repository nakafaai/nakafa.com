import { Particles } from "@repo/design-system/components/ui/particles";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "cn";
import type { ReactNode } from "react";
import { ChatHeader } from "@/components/ai/chat/header";
import { StartPrompt, useStartChat } from "@/components/ai/chat/start";
import { NinaInput } from "@/components/ai/input";
import { useCurrentLocale } from "@/lib/routing/link";

/** Moves directly from the welcome screen into the final conversation layout. */
export function ChatNew({
  children,
  title,
}: {
  children: ReactNode;
  title: ReactNode;
}) {
  const locale = useCurrentLocale();
  const navigate = useNavigate();
  const { disabled, prompt, submit } = useStartChat({
    onComplete: (chatId) =>
      navigate({ params: { id: chatId, locale }, to: "/$locale/chat/$id" }),
  });

  return (
    <div
      className={cn(
        "relative flex size-full min-w-0 flex-col overflow-hidden text-chat",
        !prompt && "justify-center gap-4"
      )}
    >
      {prompt ? (
        <ChatHeader />
      ) : (
        <>
          <Particles className="pointer-events-none absolute inset-0 opacity-80" />
          <div className="absolute inset-x-0 top-0">
            <ChatHeader />
          </div>
        </>
      )}
      {prompt ? (
        <StartPrompt className="mx-auto w-full max-w-3xl p-6" prompt={prompt} />
      ) : (
        <div className="relative mx-auto w-full max-w-xl px-6">{title}</div>
      )}
      <div
        className={cn(
          "relative mx-auto grid w-full shrink-0",
          prompt ? "max-w-3xl px-4 pb-4" : "max-w-3xl px-6"
        )}
        key="composer"
      >
        <NinaInput disabled={disabled} onSubmit={submit} />
      </div>
      {prompt ? null : (
        <div className="relative mx-auto w-full max-w-xl px-6">{children}</div>
      )}
    </div>
  );
}

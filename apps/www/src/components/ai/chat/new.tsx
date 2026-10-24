import { Particles } from "@repo/design-system/components/ui/particles";
import { useCurrentLocale } from "@repo/internationalization/src/link";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "cn";
import type { ComponentProps, ReactNode } from "react";
import { ChatHeader } from "@/components/ai/chat/header";
import { StartPrompt, useStartChat } from "@/components/ai/chat/start";
import { NinaInput } from "@/components/ai/input";
import { ConvexIsland } from "@/components/providers/island";
import { useLiveSession } from "@/components/providers/live";
import { useCurrentAuthNavigation } from "@/lib/auth/location";

/**
 * Moves directly from the welcome screen into the final conversation layout. Only
 * a signed-in learner's composer reads Convex, so a visitor's composer loads no
 * admission code and opens no client. A visitor's composer sends to sign-in.
 */
export function ChatNew({
  children,
  title,
}: {
  children: ReactNode;
  title: ReactNode;
}) {
  const isSessionPending = useLiveSession((state) => state.isPending);
  return (
    <ConvexIsland
      fallback={
        isSessionPending ? (
          <PendingChatNew title={title}>{children}</PendingChatNew>
        ) : (
          <VisitorChatNew title={title}>{children}</VisitorChatNew>
        )
      }
    >
      <SignedInChatNew title={title}>{children}</SignedInChatNew>
    </ConvexIsland>
  );
}

/** The welcome layout of a new chat, which every variant of the page shares. */
function NewChatLayout({
  children,
  composer,
  prompt,
  title,
}: {
  children: ReactNode;
  composer: ReactNode;
  prompt?: ComponentProps<typeof StartPrompt>["prompt"];
  title: ReactNode;
}) {
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
        {composer}
      </div>
      {prompt ? null : (
        <div className="relative mx-auto w-full max-w-xl px-6">{children}</div>
      )}
    </div>
  );
}

/** A learner's composer, whose admission and submission run on the page's client. */
function SignedInChatNew({
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
    <NewChatLayout
      composer={<NinaInput disabled={disabled} onSubmit={submit} />}
      prompt={prompt}
      title={title}
    >
      {children}
    </NewChatLayout>
  );
}

/** A visitor's composer: its attach button and its send both ask for sign-in. */
function VisitorChatNew({
  children,
  title,
}: {
  children: ReactNode;
  title: ReactNode;
}) {
  const navigate = useNavigate();
  const authNavigation = useCurrentAuthNavigation();

  function signIn() {
    navigate(authNavigation.readTarget());
    return false;
  }

  return (
    <NewChatLayout
      composer={
        <NinaInput
          attachments={false}
          onAttachRequest={signIn}
          onSubmit={signIn}
        />
      }
      title={title}
    >
      {children}
    </NewChatLayout>
  );
}

/** A composer while the session loads: its send waits for the session, so it offers neither sign-in nor a send. */
function PendingChatNew({
  children,
  title,
}: {
  children: ReactNode;
  title: ReactNode;
}) {
  return (
    <NewChatLayout
      composer={
        <NinaInput attachments={false} disabled onSubmit={() => false} />
      }
      title={title}
    >
      {children}
    </NewChatLayout>
  );
}

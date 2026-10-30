import { Particles } from "@repo/design-system/components/ui/particles";
import type { PromptInputMessage } from "@repo/design-system/lib/prompt-input/submission";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "cn";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  use,
  useEffect,
  useState,
} from "react";
import { createStore, type StoreApi, useStore } from "zustand";
import { NinaHeldAttach } from "@/components/ai/attachment";
import { ChatHeader } from "@/components/ai/chat/header";
import { StartPrompt, useStartChat } from "@/components/ai/chat/start";
import { HomeTitle } from "@/components/ai/home/title";
import { NinaInput } from "@/components/ai/input";
import { ConvexIsland } from "@/components/providers/island";
import { useLiveSession } from "@/components/providers/live";
import { hasSignedInHint } from "@/lib/auth/hint";
import { useCurrentAuthNavigation } from "@/lib/auth/location";
import { useCurrentLocale } from "@/lib/routing/link";

/**
 * The send and the attach a learner pressed while the page's session loaded,
 * until a composer takes them.
 */
interface HeldSend {
  readonly attach: boolean;
  readonly held: PromptInputMessage | null;
  readonly hold: (message: PromptInputMessage | null) => void;
  readonly holdAttach: (attach: boolean) => void;
}

/** Creates the held send of one new-chat page. */
function createHeldSendStore() {
  return createStore<HeldSend>()((set) => ({
    attach: false,
    held: null,
    hold: (message) => set({ held: message }),
    holdAttach: (attach) => set({ attach }),
  }));
}

/**
 * Whether the page's session has yet to settle: a page with the signed-in hint
 * starts it after React takes the page over, and a read that failed settles it.
 */
function isSessionUnsettled(hasSessionError: boolean) {
  return hasSignedInHint(document.cookie) && !hasSessionError;
}

const HeldSendContext = createContext<StoreApi<HeldSend> | null>(null);

/** Reads one part of the send held on the new-chat page. */
function useHeldSend<Selected>(selector: (state: HeldSend) => Selected) {
  const store = use(HeldSendContext);
  if (!store) {
    // A composer outside its page is a composition error at this seam.
    throw new Error("A new-chat composer renders inside ChatNew.");
  }
  return useStore(store, selector);
}

/**
 * Moves directly from the welcome screen into the final conversation layout. Only
 * a signed-in learner's composer reads Convex, so a visitor's composer loads no
 * admission code and opens no client. A visitor's composer sends to sign-in.
 * While the session loads the composer looks the same and holds a send, which
 * the signed-in composer then admits, or the visitor's sends to sign-in, so the
 * composer never dims and comes back. The server draws the visitor's composer,
 * and a page with the signed-in hint keeps it until its session starts, so that
 * composer holds an attach until the session settles: the signed-in composer
 * then opens its file picker, and a visitor's asks for sign-in.
 */
export function ChatNew({ children }: { children: ReactNode }) {
  const isSessionPending = useLiveSession((state) => state.isPending);
  const [heldSend] = useState(createHeldSendStore);
  return (
    <HeldSendContext value={heldSend}>
      <ConvexIsland
        fallback={
          isSessionPending ? (
            <PendingChatNew>{children}</PendingChatNew>
          ) : (
            <VisitorChatNew>{children}</VisitorChatNew>
          )
        }
      >
        <SignedInChatNew>{children}</SignedInChatNew>
      </ConvexIsland>
    </HeldSendContext>
  );
}

/** The welcome layout of a new chat, which every variant of the page shares. */
function NewChatLayout({
  children,
  composer,
  prompt,
}: {
  children: ReactNode;
  composer: ReactNode;
  prompt?: ComponentProps<typeof StartPrompt>["prompt"];
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
        <StartPrompt
          className="mx-auto w-full max-w-7xl px-4 py-6"
          prompt={prompt}
        />
      ) : (
        <div className="relative mx-auto w-full max-w-xl px-6">
          <HomeTitle />
        </div>
      )}
      <div
        className={cn(
          "relative mx-auto grid w-full shrink-0",
          prompt ? "max-w-7xl px-4 pb-4" : "max-w-3xl px-6"
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
function SignedInChatNew({ children }: { children: ReactNode }) {
  const locale = useCurrentLocale();
  const navigate = useNavigate();
  const { disabled, prompt, submit } = useStartChat({
    onComplete: (chatId) =>
      navigate({ params: { id: chatId, locale }, to: "/$locale/chat/$id" }),
  });
  const held = useHeldSend((state) => state.held);
  const hold = useHeldSend((state) => state.hold);
  const attach = useHeldSend((state) => state.attach);
  const holdAttach = useHeldSend((state) => state.holdAttach);

  // A send pressed while the session loaded is admitted once this composer mounts.
  useEffect(() => {
    if (held === null) {
      return;
    }
    hold(null);
    submit(held);
  }, [held, hold, submit]);

  return (
    <NewChatLayout
      composer={
        <NinaInput disabled={disabled} onSubmit={submit}>
          {attach ? <NinaHeldAttach onOpen={() => holdAttach(false)} /> : null}
        </NinaInput>
      }
      prompt={prompt}
    >
      {children}
    </NewChatLayout>
  );
}

/**
 * A visitor's composer: its attach button and its send both ask for sign-in, and
 * so does a send or an attach held while the session loaded. Until a page with
 * the signed-in hint has settled its session, an attach is held instead.
 */
function VisitorChatNew({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const authNavigation = useCurrentAuthNavigation();
  const held = useHeldSend((state) => state.held);
  const hold = useHeldSend((state) => state.hold);
  const attach = useHeldSend((state) => state.attach);
  const holdAttach = useHeldSend((state) => state.holdAttach);
  const hasSessionError = useLiveSession((state) => state.hasError);

  function signIn() {
    navigate(authNavigation.readTarget());
    return false;
  }

  function requestAttach() {
    if (isSessionUnsettled(hasSessionError)) {
      holdAttach(true);
      return;
    }
    signIn();
  }

  useEffect(() => {
    if ((held === null && !attach) || isSessionUnsettled(hasSessionError)) {
      return;
    }
    hold(null);
    holdAttach(false);
    navigate(authNavigation.readTarget());
  }, [
    attach,
    authNavigation,
    hasSessionError,
    held,
    hold,
    holdAttach,
    navigate,
  ]);

  return (
    <NewChatLayout
      composer={
        <NinaInput
          attachments={false}
          onAttachRequest={requestAttach}
          onSubmit={signIn}
        />
      }
    >
      {children}
    </NewChatLayout>
  );
}

/**
 * A composer while the session loads. It looks like the others and keeps the
 * draft, and its send is held for the composer that follows once the session
 * settles.
 */
function PendingChatNew({ children }: { children: ReactNode }) {
  const hold = useHeldSend((state) => state.hold);
  return (
    <NewChatLayout
      composer={
        <NinaInput
          attachments={false}
          onSubmit={(message) => {
            hold(message);
            return false;
          }}
        />
      }
    >
      {children}
    </NewChatLayout>
  );
}

import type { PromptInputMessage } from "@repo/design-system/lib/prompt/submission";
import { useNavigate } from "@tanstack/react-router";
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
import type { useChatAdmission } from "@/components/ai/chat/admission";
import { useStartChat } from "@/components/ai/chat/start";
import { NinaInput, NinaSuggestions } from "@/components/ai/input";
import { ConvexIsland } from "@/components/providers/island";
import { useLiveSession } from "@/components/providers/live";
import { hasSignedInHint } from "@/lib/auth/hint";
import { useCurrentAuthNavigation } from "@/lib/auth/location";

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

/** Creates the held send of one new chat. */
function createHeldSendStore() {
  return createStore<HeldSend>()((set) => ({
    attach: false,
    held: null,
    hold: (message) => set({ held: message }),
    holdAttach: (attach) => set({ attach }),
  }));
}

/** What the surface decided about its new chat and the send it holds, for the variant that draws its composer. */
const NewChatContext = createContext<{
  readonly admission: Parameters<typeof useChatAdmission>[0];
  readonly held: StoreApi<HeldSend>;
  readonly holds: boolean;
} | null>(null);

/** Reads the surface's new chat, which every part of the composer renders inside. */
function useNewChatContext() {
  const value = use(NewChatContext);
  if (value === null) {
    // A part of the composer outside its new chat is a composition error at this seam.
    throw new Error("A new-chat composer renders inside NewChat.");
  }
  return value;
}

/** Reads one part of the send held by the new chat. */
function useHeldSend<Selected>(selector: (state: HeldSend) => Selected) {
  return useStore(useNewChatContext().held, selector);
}

/** The composer as its variant draws it: the variant, the prompt on its way, and what the field does. */
interface NewChatComposer {
  readonly attachments: boolean;
  readonly disabled: boolean;
  readonly onAttachRequest?: ComponentProps<
    typeof NinaInput
  >["onAttachRequest"];
  readonly onSubmit: ComponentProps<typeof NinaInput>["onSubmit"];
  readonly prompt: ReturnType<typeof useStartChat>["prompt"];
  readonly variant: "pending" | "signed-in" | "visitor";
}

const ComposerContext = createContext<NewChatComposer | null>(null);

/** Reads the composer its variant drew. */
function useComposer() {
  const value = use(ComposerContext);
  if (value === null) {
    throw new Error("A new-chat composer part renders inside NewChat.");
  }
  return value;
}

/**
 * Whether the page's session has yet to settle: a page with the signed-in hint
 * starts it after React takes the page over, and a read that failed settles it.
 */
function isSessionUnsettled(hasSessionError: boolean) {
  return hasSignedInHint(document.cookie) && !hasSessionError;
}

/**
 * The one composer of a new chat with Nina, which the new-chat page and the sheet lay out their own way. It picks
 * its variant once: a signed-in learner's composer reads Convex, so a visitor's and a loading session's load no
 * admission code and open no client. A visitor's composer asks for sign-in. While the session loads the composer
 * looks the same and, where the surface `holds`, as the page does, keeps a send and an attach for the composer that
 * follows: the signed-in composer then admits the send and opens the file picker, and a visitor's asks for sign-in,
 * so the composer never dims and comes back; elsewhere it waits disabled, as the sheet's does. `admission` is what
 * the surface decides about the rest: what a finished admission does, what asking for sign-in does first, and whether
 * the surface shows. The surface takes the composer's parts, `NewChatInput`, `NewChatSuggestions` and the prompt on
 * its way (`useNewChatPrompt`), and places them in its own layout.
 */
export function NewChat({
  admission,
  children,
  holds,
}: {
  admission: Parameters<typeof useChatAdmission>[0];
  children: ReactNode;
  holds: boolean;
}) {
  const isSessionPending = useLiveSession((state) => state.isPending);
  const [held] = useState(createHeldSendStore);

  return (
    <NewChatContext value={{ admission, held, holds }}>
      <ConvexIsland
        fallback={
          isSessionPending ? (
            <PendingComposer>{children}</PendingComposer>
          ) : (
            <VisitorComposer>{children}</VisitorComposer>
          )
        }
      >
        <SignedInComposer>{children}</SignedInComposer>
      </ConvexIsland>
    </NewChatContext>
  );
}

/** The prompt on its way, which the surface shows in place of its welcome once there is one. */
export function useNewChatPrompt() {
  return useComposer().prompt;
}

/**
 * The composer's field, with what the surface adds inside it. A signed-in composer opens the file picker for an
 * attach held while the session loaded, and takes the focus when the surface asks it to (`autoFocus`).
 */
export function NewChatInput({
  autoFocus = false,
  children,
}: {
  autoFocus?: boolean;
  children?: ReactNode;
}) {
  const composer = useComposer();
  const attach = useHeldSend((state) => state.attach);
  const holdAttach = useHeldSend((state) => state.holdAttach);
  const signedIn = composer.variant === "signed-in";

  return (
    <NinaInput
      attachments={composer.attachments}
      autoFocus={signedIn && autoFocus}
      disabled={composer.disabled}
      onAttachRequest={composer.onAttachRequest}
      onSubmit={composer.onSubmit}
    >
      {signedIn && attach ? (
        <NinaHeldAttach onOpen={() => holdAttach(false)} />
      ) : null}
      {children}
    </NinaInput>
  );
}

/** The prompts Nina suggests, which a composer offers once it can answer and until a prompt is on its way. */
export function NewChatSuggestions() {
  const composer = useComposer();

  if (composer.variant === "pending" || composer.prompt !== null) {
    return null;
  }
  return (
    <NinaSuggestions
      disabled={composer.disabled}
      onSubmit={composer.onSubmit}
    />
  );
}

/** A signed-in learner's composer, whose admission and submission run on the page's client. */
function SignedInComposer({ children }: { children: ReactNode }) {
  const { disabled, prompt, submit } = useStartChat(
    useNewChatContext().admission
  );
  const held = useHeldSend((state) => state.held);
  const hold = useHeldSend((state) => state.hold);

  // A send pressed while the session loaded is admitted once this composer mounts.
  useEffect(() => {
    if (held === null) {
      return;
    }
    hold(null);
    submit(held);
  }, [held, hold, submit]);

  return (
    <ComposerContext
      value={{
        attachments: true,
        disabled,
        onSubmit: submit,
        prompt,
        variant: "signed-in",
      }}
    >
      {children}
    </ComposerContext>
  );
}

/**
 * A visitor's composer: its attach button and its send both ask for sign-in, and so does a send or an attach held
 * while the session loaded. Until a page with the signed-in hint has settled its session, a surface that holds keeps
 * an attach instead.
 */
function VisitorComposer({ children }: { children: ReactNode }) {
  const {
    admission: { onSignIn },
    holds,
  } = useNewChatContext();
  const navigate = useNavigate();
  const authNavigation = useCurrentAuthNavigation();
  const held = useHeldSend((state) => state.held);
  const hold = useHeldSend((state) => state.hold);
  const attach = useHeldSend((state) => state.attach);
  const holdAttach = useHeldSend((state) => state.holdAttach);
  const hasSessionError = useLiveSession((state) => state.hasError);

  function signIn() {
    onSignIn?.();
    navigate(authNavigation.readTarget());
    return false;
  }

  function requestAttach() {
    if (holds && isSessionUnsettled(hasSessionError)) {
      holdAttach(true);
      return;
    }
    signIn();
  }

  // A send or an attach held while the session loaded asks for sign-in once it settles without one.
  useEffect(() => {
    if ((held === null && !attach) || isSessionUnsettled(hasSessionError)) {
      return;
    }
    hold(null);
    holdAttach(false);
    onSignIn?.();
    navigate(authNavigation.readTarget());
  }, [
    attach,
    authNavigation,
    hasSessionError,
    held,
    hold,
    holdAttach,
    navigate,
    onSignIn,
  ]);

  return (
    <ComposerContext
      value={{
        attachments: false,
        disabled: false,
        onAttachRequest: requestAttach,
        onSubmit: signIn,
        prompt: null,
        variant: "visitor",
      }}
    >
      {children}
    </ComposerContext>
  );
}

/**
 * A composer while the session loads. It looks like the others and keeps the draft: where the surface holds, its send
 * waits for the composer that follows; elsewhere it waits disabled, offering neither sign-in nor a send.
 */
function PendingComposer({ children }: { children: ReactNode }) {
  const { holds } = useNewChatContext();
  const hold = useHeldSend((state) => state.hold);

  return (
    <ComposerContext
      value={{
        attachments: false,
        disabled: !holds,
        onSubmit: (message) => {
          if (holds) {
            hold(message);
          }
          return false;
        },
        prompt: null,
        variant: "pending",
      }}
    >
      {children}
    </ComposerContext>
  );
}

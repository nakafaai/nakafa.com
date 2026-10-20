import type {
  NinaInput,
  NinaPageInput,
  NinaPrompt,
} from "@repo/backend/confect/nina/turns.spec";
import {
  type RouterPageLocation,
  readRouterPage,
} from "@/lib/routing/location";

/**
 * The page the learner is on now, as every turn names it: where they are and
 * the curriculum context their link carried. A new message and a retry name
 * the page the same way. The server decides what a retry keeps
 * (`packages/backend/confect/nina/prompt.ts`): from the page its turn was
 * asked on it keeps that turn's own context, with its placement and question
 * focus, whatever this names; from another page it names that page, with the
 * context its link carries there, because a prompt never names a page the
 * learner has left.
 */
/** The page of a router location as a Nina turn names it. */
export function readNinaPage(location: RouterPageLocation) {
  return readRouterPage(location) satisfies typeof NinaPageInput.Type;
}

/** The input of a new message, asked from the page the learner is on now. */
export function messageInput({
  focus,
  location,
  text,
  uploadIds,
}: {
  focus: typeof NinaPageInput.Type.focus;
  location: RouterPageLocation;
  text: typeof NinaPrompt.Type.text;
  uploadIds: NonNullable<typeof NinaPrompt.Type.uploadIds>;
}) {
  return {
    kind: "message",
    page: { ...readNinaPage(location), ...(focus ? { focus } : {}) },
    prompt: { text, uploadIds },
  } satisfies typeof NinaInput.Type;
}

/** The input that sends the prompt of the turn at `order` again, from the page the learner is on now. */
export function retryInput(order: number, location: RouterPageLocation) {
  return {
    kind: "retry",
    order,
    page: readNinaPage(location),
  } satisfies typeof NinaInput.Type;
}

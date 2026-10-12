import type {
  NinaInput,
  NinaPageInput,
  NinaPrompt,
} from "@repo/backend/confect/nina/turns.spec";
import {
  getLocale,
  getMaterialContextHint,
  getPathname,
} from "@/lib/routing/location";

/**
 * The page the learner is on now, as every turn names it: where they are and
 * the curriculum context their link carried. A new message and a retry name
 * the page the same way, so a retry from another page than the first try
 * keeps the lesson context of the page it is pressed on.
 */
export function readNinaPage() {
  const hint = getMaterialContextHint();
  return {
    locale: getLocale(),
    slug: getPathname(),
    ...(hint ? { materialContextHint: hint } : {}),
  } satisfies typeof NinaPageInput.Type;
}

/** The input of a new message, asked from the page the learner is on now. */
export function messageInput({
  focus,
  text,
  uploadIds,
}: {
  focus: typeof NinaPageInput.Type.focus;
  text: typeof NinaPrompt.Type.text;
  uploadIds: NonNullable<typeof NinaPrompt.Type.uploadIds>;
}) {
  return {
    kind: "message",
    page: { ...readNinaPage(), ...(focus ? { focus } : {}) },
    prompt: { text, uploadIds },
  } satisfies typeof NinaInput.Type;
}

/** The input that sends the prompt of the turn at `order` again, from the page the learner is on now. */
export function retryInput(order: number) {
  return {
    kind: "retry",
    order,
    page: readNinaPage(),
  } satisfies typeof NinaInput.Type;
}

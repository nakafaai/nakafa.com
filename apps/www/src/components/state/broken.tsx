import { Effect } from "effect";
import { ActionButton } from "@/components/state/action";

/**
 * Tries again by loading the document again. The framework's own `retry`
 * renders the broken part again in the same document, and that cannot bring
 * back a part whose code failed to load: React keeps a failed import for as
 * long as the document lives, so the part breaks again. Measured on a local
 * production build on 13 October 2026: after chunks had failed to load, `retry`
 * left the broken state up in 10 of 15 tries. A new document asks for
 * everything again.
 */
const reloadDocument = Effect.fn("www.state.reloadDocument")(() =>
  Effect.sync(() => window.location.reload())
);

/**
 * The main way on from something that broke, the first action of its page's state (`EmptyState` on a `page`, with Nina
 * at her keyboard): it loads the document again, under the label it holds. The state never shows the error itself,
 * only that it is not the learner's; the page that renders it reports what it caught.
 */
export function BrokenRetry({ children }: { children: string }) {
  return (
    <ActionButton
      label={children}
      onClick={() => Effect.runSync(reloadDocument())}
      variant="default"
    />
  );
}

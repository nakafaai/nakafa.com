import { Effect } from "effect";
import { ActionButton, ActionLink } from "@/components/state/action";
import { DeferredFigure } from "@/components/state/mascot";
import { Screen } from "@/components/state/screen";

interface BrokenProps {
  description: string;
  /** The label of the quiet way on, to the home page. */
  home: string;
  homeHref: string;
  /** The label of the main action. */
  retry: string;
  title: string;
}

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
 * The state of something that broke: Nina at her keyboard, one action that
 * tries again, and one quiet way home. It never shows the error itself, only
 * that it is not the learner's. The error is reported by the page that renders
 * it, which also knows what it caught.
 */
export function Broken({
  description,
  home,
  homeHref,
  retry,
  title,
}: BrokenProps) {
  return (
    <Screen
      actions={
        <>
          <ActionButton
            label={retry}
            onClick={() => Effect.runSync(reloadDocument())}
            variant="default"
          />
          <ActionLink href={homeHref} label={home} variant="ghost" />
        </>
      }
      description={description}
      figure={<DeferredFigure scene="broken" />}
      title={<h1>{title}</h1>}
    />
  );
}

import { Effect } from "effect";
import type { ReactNode } from "react";
import { ActionButton } from "@/components/state/action";
import { DeferredFigure } from "@/components/state/mascot";
import {
  Screen,
  ScreenActions,
  ScreenDescription,
  ScreenFigure,
  ScreenHeader,
  ScreenTitle,
} from "@/components/state/screen";

interface BrokenProps {
  /** The ways on, as the page composes them: `BrokenRetry`, then a quiet way home. */
  children: ReactNode;
  description: string;
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
export function Broken({ children, description, title }: BrokenProps) {
  return (
    <Screen>
      <ScreenHeader>
        <ScreenFigure>
          <DeferredFigure scene="broken" />
        </ScreenFigure>
        <ScreenTitle>
          <h1>{title}</h1>
        </ScreenTitle>
        <ScreenDescription>{description}</ScreenDescription>
      </ScreenHeader>
      <ScreenActions>{children}</ScreenActions>
    </Screen>
  );
}

/** The main way on from something that broke: it loads the document again, under the label it holds. */
export function BrokenRetry({ children }: { children: string }) {
  return (
    <ActionButton
      label={children}
      onClick={() => Effect.runSync(reloadDocument())}
      variant="default"
    />
  );
}

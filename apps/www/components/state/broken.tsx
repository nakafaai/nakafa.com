"use client";

import { Effect, Schema } from "effect";
import { createContext, use } from "react";
import { ActionButton, ActionLink } from "@/components/state/action";
import { DeferredFigure } from "@/components/state/figure.client";
import { Screen } from "@/components/state/screen";

/** The quiet way home of a broken page: its label and the page it leads to. */
const BrokenHome = Schema.Struct({
  home: Schema.String,
  homeHref: Schema.String,
});

const BrokenHomeContext = createContext<typeof BrokenHome.Type | null>(null);

/** Reads the quiet way home that the broken page shows. */
function useBrokenHome() {
  const home = use(BrokenHomeContext);
  if (home === null) {
    throw new Error("useBrokenHome must be used within Broken");
  }
  return home;
}

/** The quiet way home, which reads its label and its link from Broken. */
function BrokenHomeLink() {
  const { home, homeHref } = useBrokenHome();
  return <ActionLink href={homeHref} label={home} variant="ghost" />;
}

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
    <BrokenHomeContext value={{ home, homeHref }}>
      <Screen
        actions={
          <>
            <ActionButton
              label={retry}
              onClick={() => Effect.runSync(reloadDocument())}
              variant="default"
            />
            <BrokenHomeLink />
          </>
        }
        description={description}
        figure={<DeferredFigure scene="broken" />}
        title={<h1>{title}</h1>}
      />
    </BrokenHomeContext>
  );
}

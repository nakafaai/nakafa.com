import { laterCode, openLaterCode } from "@/components/marketing/shared/code";

/** The code of the set's worked samples, which reaches KaTeX and the Markdown reader. */
export const samplesCode = laterCode(() =>
  import("@/components/tryout/set/samples").then(
    (module) => module.TryoutSetSamples
  )
);

/**
 * Loads the samples' code. The set route opens it before a load that renders the page whole, on the
 * server and on a client navigation, so the page commits with its samples. The first document never
 * runs it, nor does a warm of a link to the set, and the samples load as they near the screen.
 */
export function openSetSamples() {
  return openLaterCode(samplesCode);
}

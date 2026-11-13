import { getRouteApi } from "@tanstack/react-router";
import { LaterSection } from "@/components/marketing/shared/later";
import { samplesCode } from "@/components/tryout/set/code";

const setRoute = getRouteApi(
  "/$locale/_main/try-out/$country/$exam/$group/$track/$set/"
);

/**
 * The set's worked samples under its parts, in a hydration boundary of their own: the static page draws
 * them from its HTML, and their code stays out of the page's first JavaScript until the reader nears
 * them. A set without samples draws nothing.
 */
export function TryoutSetSamplesLater() {
  const shown = setRoute.useLoaderData({
    select: (route) => route.samples.length > 0,
  });
  if (!shown) {
    return null;
  }

  return (
    <LaterSection code={samplesCode}>{(Samples) => <Samples />}</LaterSection>
  );
}

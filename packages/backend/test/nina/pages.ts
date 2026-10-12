import { Effect } from "effect";

/**
 * A page reader that reads the given pages by address; any other page is not
 * read in time, as when the provider refuses it.
 */
export function readsPages(pages: Readonly<Record<string, string>>) {
  return (url: string) => {
    const markdown = pages[url];
    return Effect.succeed(
      markdown === undefined
        ? { error: "The page could not be retrieved.", metadata: {}, url }
        : { markdown, metadata: {}, url }
    );
  };
}

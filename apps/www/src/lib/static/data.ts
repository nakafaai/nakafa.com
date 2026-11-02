import { createIsomorphicFn } from "@tanstack/react-start";
import { Effect, Option } from "effect";

/** Records a call for the build. The compiler drops this from the browser, so only a server reaches the module. */
const recordCall = createIsomorphicFn().server(
  async (url: string, data: unknown) => {
    const { recordStaticCall } = await import("@/lib/static/record.server");
    await Effect.runPromise(recordStaticCall(url, data));
  }
);

/**
 * Reads one server function for a loader of a prerendered page. On the server the
 * function runs as it always does, and while the build prerenders the page the
 * Worker records the call, so the build writes its answer as a static file. In
 * the browser the loader reads that file from the static assets and hands it to
 * the function's own decoder, so a navigation between prerendered pages costs no
 * Worker request and no server work. A call that the build did not prerender asks
 * the Worker. Each side imports its reader on its first call, so neither reader
 * weighs on a page's first JavaScript.
 *
 * In the browser every server component in the answer is settled before the
 * loader resolves (`settle.ts`), its math faces loaded, so the route that shows
 * it commits whole.
 */
export async function readStaticData<Input, Output>(
  // The server function: its address names it, it takes one input, and it
  // accepts the Response that its call answers with.
  fn: ((options: {
    readonly data: Input;
    readonly fetch?: () => Promise<Response>;
  }) => Promise<Output>) & { readonly url: string },
  data: Input
): Promise<Output> {
  if (import.meta.env.SSR) {
    await recordCall(fn.url, data);
    return fn({ data });
  }
  const [{ readStaticAnswer }, { settleServerComponents }] = await Promise.all([
    import("@/lib/static/answer"),
    import("@/lib/static/settle"),
  ]);
  const answer = await Effect.runPromise(readStaticAnswer(fn.url, data));
  const output = await Option.match(answer, {
    onNone: () => fn({ data }),
    onSome: (response) => fn({ data, fetch: () => Promise.resolve(response) }),
  });
  await Effect.runPromise(settleServerComponents(output, document.fonts));
  return output;
}

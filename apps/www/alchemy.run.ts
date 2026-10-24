import { providers, state, Website } from "@alchemy.run/cloudflare";
import { Stack } from "alchemy";
import { Effect } from "effect";

/**
 * The Start app. Alchemy builds it with this app's own vite.config.ts, uploads the
 * client build as static assets, and makes the SSR bundle the Worker entry. The
 * React Server Components environment ships beside that entry.
 */
const Web = Website.Vite("Web", {
  viteEnvironments: { entry: "ssr", children: ["rsc"] },
});

export default Stack(
  "Nakafa",
  {
    providers: providers(),
    state: state(),
  },
  Effect.gen(function* () {
    const web = yield* Web;

    return { url: web.url.as<string>() };
  })
);

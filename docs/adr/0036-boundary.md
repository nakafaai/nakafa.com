# ADR 0036: The Start Import Boundary Keeps Server Code Out Of The Browser

## Status

Accepted in the review of the Start build on 20 October 2026. It records the
boundary that `apps/www/vite.config.ts` enforces with the import protection
defaults of TanStack Start, and the module naming that the build requires.

## Context

The TanStack Start build renders client components on the server during the RSC
pass, and it ships the browser environment separately. A server secret, a Node
built-in, or a verifier that needs Node must never reach a browser module. The
Start plugin's import protection is the check that enforces this, and the
prerender check proves the output.

The import protection checks the importers inside the Start source directory,
`apps/www/src`, which is the plugin's default. Every application module lives
there, so no importer escapes the check.

## Decision

- Browser code reaches server code only through server functions and `.server.ts`
  modules. The import protection is an error in the browser environment in dev
  and build.
- The server environment rejects every `.client` module, with the plugin's
  default rule. A module that the server reaches, directly or through a client
  component that the RSC pass renders, carries no `.client` suffix. The suffix
  names only a browser module that no server module reaches.
- The browser environment rejects every `node:` specifier, subpaths included,
  because Node built-ins have no browser build. The default client specifiers
  of TanStack stay in force.
- A module that reads a secret, such as `LOGIN_CARD_SECRET`, lives in a Confect
  module that only Convex functions import. A browser module imports the pure
  helpers beside it, never the secret reader.
- The build proves the output. `verifyPrerenderedPages` rejects any page that
  is not in the listed set and any page that carries the server failure marker.

## Consequences

- The default rules apply in both passes. A `.server` module that the browser
  imports, a `.client` module that the server imports, and a `node:` specifier in
  the browser each fail the build.
- A client component's module keeps its domain name, such as `env.public.ts`
  for the browser-safe environment reader, and its suffix is not a boundary.
- A new secret reader needs its own Confect module. A helper that a browser form
  needs stays in a module without a secret read.

## Rejected Alternatives

- Turning the `.client` file rule off in the server pass. The suffix would then
  promise a browser-only module that the build does not check, so the modules
  that the server reaches lost the suffix instead.
- Aliasing Node modules to browser stubs. A stub hides the violation, and the
  build reports nothing.

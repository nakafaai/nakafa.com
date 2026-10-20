# ADR 0036: The Start Import Boundary Keeps Server Code Out Of The Browser

## Status

Accepted in the review of the Start build on 20 October 2026. It records the
boundary that `apps/www/vite.config.ts` enforces, including the one exception
that the build needs.

## Context

The TanStack Start build renders client components on the server during the RSC
pass, and it ships the browser environment separately. A server secret, a Node
built-in, or a verifier that needs Node must never reach a browser module. The
Start plugin's import protection is the check that enforces this, and the
prerender check proves the output.

## Decision

- Browser code reaches server code only through server functions and `.server.ts`
  modules. The import protection is an error in the browser environment in dev
  and build.
- The browser environment rejects every `node:` specifier, subpaths included,
  because Node built-ins have no browser build. The default client specifiers of
  TanStack stay in force.
- The file rule for `.client` modules is off in the server pass
  (`importProtection.server.files: []`). Client components render during the RSC
  pass, so their `.client` modules belong to the server bundle. The browser keeps
  its rule against `.server` modules.
- A module that reads a secret, such as `LOGIN_CARD_SECRET`, lives in a Confect
  module that only Convex functions import. A browser module imports the pure
  helpers beside it, never the secret reader.
- The build proves the output. `verifyPrerenderedPages` rejects any page that
  is not in the listed set and any page that carries the server failure marker.

## Consequences

- A `.client` file that a server component imports is not checked by a file rule.
  The browser rule against `.server` modules, the `server-only` markers, and the
  `node:` rule still apply in each environment, and a violation fails the build.
- A new secret reader needs its own Confect module. A helper that a browser form
  needs stays in a module without a secret read.

## Rejected Alternatives

- Keeping the `.client` file rule in the server pass. It would reject every client
  component that the RSC pass renders.
- Aliasing Node modules to browser stubs. A stub hides the violation, and the
  build reports nothing.

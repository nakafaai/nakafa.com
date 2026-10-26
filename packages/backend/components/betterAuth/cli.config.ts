import type { GenericCtx } from "@convex-dev/better-auth";
import { createAuthOptions } from "@repo/backend/confect/auth/runtime";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { betterAuth } from "better-auth/minimal";

/**
 * The configuration that the Better Auth command line tool loads to generate
 * `schema.ts`.
 *
 * The tool runs outside a Convex request. The local install guide therefore
 * requires a placeholder context for this static instance. Nothing at run time
 * imports this file. Regenerate with `bun --filter @repo/backend
 * generate-schema`, which names this file: the tool's own lookup, and the
 * command in the generated header, do not find it.
 *
 * The command runs the tool from the package root, because the tool reads the
 * workspace path aliases only from a `tsconfig.json` in its working directory,
 * and packages such as `@repo/email` import themselves through those aliases.
 * It turns jiti's file cache off, because that cache keys a transform by its
 * source alone and would serve the copies that Confect codegen cached without
 * the tool's alias rewrite. The tool writes `schema.ts` into its working
 * directory and the command moves it here, since an `--output` path would put
 * this checkout's absolute path into the generated header.
 * @see https://labs.convex.dev/better-auth/features/local-install#generate-the-schema
 */
export const auth = betterAuth(createAuthOptions({} as GenericCtx<DataModel>));

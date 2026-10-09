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
 * imports this file. Regenerate with `pnpm --filter @repo/backend
 * generate-schema`, which names this file: the tool's own lookup, and the
 * command in the generated header, do not find it.
 * @see https://labs.convex.dev/better-auth/features/local-install#generate-the-schema
 */
export const auth = betterAuth(createAuthOptions({} as GenericCtx<DataModel>));

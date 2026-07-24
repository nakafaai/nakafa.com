import "server-only";

import type { RendererDomain } from "@nakafa/aksara-contracts/renderer/domain";
import { snbtGeneralComponents } from "@repo/design-system/lib/markdown/domain/snbt/general";
import { snbtMathComponents } from "@repo/design-system/lib/markdown/domain/snbt/mathematics";
import { snbtPlainComponents } from "@repo/design-system/lib/markdown/domain/snbt/plain";
import { snbtQuantComponents } from "@repo/design-system/lib/markdown/domain/snbt/quantitative";
import { tkaMathComponents } from "@repo/design-system/lib/markdown/domain/tka/mathematics";
import type { MDXComponents } from "@repo/design-system/types/markdown";
import { Effect, Schema } from "effect";

/** A signed try-out artifact requested a non-try-out renderer domain. */
export class TryoutRendererDomainError extends Schema.TaggedError<TryoutRendererDomainError>()(
  "TryoutRendererDomainError",
  {
    domain: Schema.String,
  }
) {}

/** Resolves one signed domain to its route-owned physical registry. */
export function resolveTryoutComponents(
  domain: RendererDomain
): Effect.Effect<MDXComponents, TryoutRendererDomainError> {
  if (domain === "snbt-general") {
    return Effect.succeed(snbtGeneralComponents);
  }
  if (domain === "snbt-math") {
    return Effect.succeed(snbtMathComponents);
  }
  if (domain === "snbt-plain") {
    return Effect.succeed(snbtPlainComponents);
  }
  if (domain === "snbt-quant") {
    return Effect.succeed(snbtQuantComponents);
  }
  if (domain === "tka-math") {
    return Effect.succeed(tkaMathComponents);
  }

  return Effect.fail(new TryoutRendererDomainError({ domain }));
}

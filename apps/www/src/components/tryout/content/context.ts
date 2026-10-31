import { createContext } from "react";
import type { TryoutBody } from "@/components/tryout/content/body";

/**
 * The decoded question bodies of the running section, which the page gives the player's articles.
 * It holds the page's bodies, fixed for one page, so it never changes above the streamed questions.
 */
export const TryoutContentContext = createContext<{
  readonly bodies: readonly TryoutBody[] | null;
} | null>(null);

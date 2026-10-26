import { createContext } from "react";
import type { TryoutRunningContent } from "@/components/tryout/content/model";

/**
 * The signed questions of the running section, rendered on the server, which
 * the page gives the player's articles. It holds the page's content, fixed for
 * one page, so it never changes above the streamed bodies.
 */
export const TryoutContentContext = createContext<{
  readonly content: TryoutRunningContent | null;
} | null>(null);

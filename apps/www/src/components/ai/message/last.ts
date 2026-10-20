import { createContext } from "react";

/**
 * Whether the message is the newest row of the transcript. The transcript row
 * that renders the message provides it, and the message's waiting state reads it.
 */
export const LastMessageContext = createContext<boolean | null>(null);

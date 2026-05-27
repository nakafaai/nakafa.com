import { chatsLayer } from "@repo/backend/confect/modules/chat/chats/chats.impl";
import { Layer } from "effect";

export const chatLayer = Layer.mergeAll(chatsLayer);

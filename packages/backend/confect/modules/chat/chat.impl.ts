import { Layer } from "effect";
import { chatsLayer } from "./chats/chats.impl";

export const chatLayer = Layer.mergeAll(chatsLayer);

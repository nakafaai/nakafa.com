import registeredFunctions from "@repo/backend/confect/_generated/registeredFunctions";

export const createChat = registeredFunctions.chats.mutations.createChat;
export const createChatWithMessage = registeredFunctions.chats.mutations.createChatWithMessage;
export const deleteChat = registeredFunctions.chats.mutations.deleteChat;
export const deleteMessageBatch = registeredFunctions.chats.mutations.deleteMessageBatch;
export const saveAssistantResponse = registeredFunctions.chats.mutations.saveAssistantResponse;
export const saveMessage = registeredFunctions.chats.mutations.saveMessage;
export const updateChatTitle = registeredFunctions.chats.mutations.updateChatTitle;
export const updateChatVisibility = registeredFunctions.chats.mutations.updateChatVisibility;

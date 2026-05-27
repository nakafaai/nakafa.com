import registeredFunctions from "@repo/backend/confect/_generated/registeredFunctions";

export const cleanup = registeredFunctions.audioStudies.mutations.queue.cleanup;
export const lockQueueItem = registeredFunctions.audioStudies.mutations.queue.lockQueueItem;
export const markQueueFailed = registeredFunctions.audioStudies.mutations.queue.markQueueFailed;
export const resetStuckQueueItems = registeredFunctions.audioStudies.mutations.queue.resetStuckQueueItems;
export const startWorkflowsForPendingItems = registeredFunctions.audioStudies.mutations.queue.startWorkflowsForPendingItems;

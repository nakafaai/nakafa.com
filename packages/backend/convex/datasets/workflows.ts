import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { workflow } from "../workflow";

/**
 * Main workflow: Create dataset with deep research.
 */
export const createDatasetWorkflow = workflow.define({
  args: {
    datasetId: v.id("datasets"),
    chatId: v.id("chats"),
    userId: v.id("users"),
    query: v.string(),
    targetRows: v.number(),
  },
  handler: async (step, args): Promise<void> => {
    const { datasetId, chatId, userId, query, targetRows } = args;

    console.log("[WORKFLOW START]", {
      datasetId,
      query: query.substring(0, 100),
      targetRows,
    });

    // Step 1: Generate columns
    console.log("[STEP 1] Generating column schema with AI...");
    const columns = await step.runAction(
      internal.datasets.actions.generateColumns,
      { query },
      { retry: true }
    );

    console.log("[STEP 1] ✓ Generated columns:", {
      count: columns.length,
      names: columns.map((c) => c.name),
    });

    // Step 2: Save columns
    console.log("[STEP 2] Saving columns to database...");
    await step.runMutation(internal.datasets.mutations.addDatasetColumns, {
      datasetId: args.datasetId,
      columns,
    });
    console.log("[STEP 2] ✓ Columns saved");

    // Step 3: Create research task
    console.log("[STEP 3] Creating research task...");
    const taskId = await step.runMutation(
      internal.datasets.mutations.addDatasetTask,
      {
        task: {
          datasetId,
          userId,
          chatId,
          type: "create_dataset",
          query,
          columnIds: columns.map((c) => c.name),
          status: "initializing",
          targetRows,
          processedRows: 0,
          successfulRows: 0,
          updatedAt: Date.now(),
        },
      }
    );
    console.log("[STEP 3] ✓ Task created:", taskId);

    // Step 4: Update status to discovering
    console.log("[STEP 4] Starting entity discovery phase...");
    await step.runMutation(
      internal.datasets.mutations.updateDatasetTaskStatus,
      { datasetTaskId: taskId, status: "discovering" }
    );
    console.log("[STEP 4] ✓ Status: discovering");

    // Step 5: Discover entities from web (with AI validation)
    console.log("[STEP 5] Discovering entities from web...", {
      targetRows,
    });
    const entities = await step.runAction(
      internal.datasets.actions.discoverEntities,
      { datasetId, query, targetRows },
      { retry: true }
    );
    console.log("[STEP 5] ✓ Entities discovered:", {
      count: entities.length,
      entities: entities.map((e, i) => ({
        index: i + 1,
        name: e.name,
        url: e.url,
      })),
    });

    // Step 6: Insert rows IMMEDIATELY with entity info in dynamicData
    console.log("[STEP 6] Inserting discovered entities into database...");
    const rowData = await step.runMutation(
      internal.datasets.mutations.insertDatasetRows,
      {
        datasetId,
        taskId,
        rows: entities.map((e, index) => ({
          dynamicData: {
            entityName: e.name,
            description: "", // Empty - will be filled
            url: e.url,
          },
          order: index,
          updatedAt: Date.now(),
        })),
      }
    );
    console.log("[STEP 6] ✓ Rows inserted:", {
      count: Object.keys(rowData).length,
    });

    // Step 7: Scrape URLs and generate descriptions
    console.log("[STEP 7] Scraping URLs and generating descriptions...", {
      urlCount: Object.keys(rowData).length,
    });
    const descriptions = await step.runAction(
      internal.datasets.actions.generateDescriptions,
      { rowData },
      { retry: true }
    );
    console.log("[STEP 7] ✓ Descriptions generated:", {
      count: Object.keys(descriptions).length,
      descriptions: Object.entries(descriptions).map(([rowId, desc]) => ({
        rowId: rowId.substring(0, 8),
        entity: rowData[rowId as Id<"datasetRows">]?.entityName,
        description: desc,
      })),
    });

    // Step 8: Update descriptions
    console.log("[STEP 8] Saving descriptions to database...");
    await step.runMutation(internal.datasets.mutations.updateRowDescriptions, {
      descriptions,
    });
    console.log("[STEP 8] ✓ Descriptions saved");

    // Step 9: Update status to researching
    console.log("[STEP 9] Starting deep research phase...");
    await step.runMutation(
      internal.datasets.mutations.updateDatasetTaskStatus,
      { datasetTaskId: taskId, status: "researching" }
    );
    console.log("[STEP 9] ✓ Status: researching");

    // Step 10: Deep research all rows (exclude base columns that are already filled)
    // Filter out entityName, description, and url - these are already discovered
    const researchColumns = columns.filter(
      (col) =>
        col.name !== "entityName" &&
        col.name !== "description" &&
        col.name !== "url"
    );

    console.log("[STEP 10] Filtered columns for deep research:", {
      totalColumns: columns.length,
      researchColumns: researchColumns.length,
      names: researchColumns.map((c) => c.name),
      excluded: ["entityName", "description", "url"],
    });

    // Only run deep research if there are additional columns to research
    if (researchColumns.length > 0) {
      console.log("[STEP 10] Starting deep research for all rows...", {
        rows: Object.keys(rowData).length,
        columns: researchColumns.length,
        totalCells: Object.keys(rowData).length * researchColumns.length,
      });

      await step.runAction(
        internal.datasets.actions.researchAllRows,
        { taskId, datasetId, rowData, descriptions, columns: researchColumns },
        { retry: true }
      );

      console.log("[STEP 10] ✓ Deep research completed");
    } else {
      console.log("[STEP 10] ⊘ No additional columns - skipping deep research");
    }

    // Step 11: Complete
    console.log("[STEP 11] Marking task as completed...");
    await step.runMutation(
      internal.datasets.mutations.updateDatasetTaskStatus,
      { datasetTaskId: taskId, status: "completed" }
    );
    console.log("[STEP 11] ✓ Task completed");

    console.log("[WORKFLOW END] ✓ Dataset creation successful", {
      datasetId,
      taskId,
    });
  },
});

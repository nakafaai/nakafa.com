import { dedentString } from "@repo/ai/lib/utils";
import { nakafaCreateDataset } from "@repo/ai/prompt/dataset";
import {
  type CreateDatasetOutput,
  createDatasetInputSchema,
} from "@repo/ai/schema/tools";
import type { MyUIMessage } from "@repo/ai/types/message";
import { api as convexApi } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { tool, type UIMessageStreamWriter } from "ai";
import { fetchMutation } from "convex/nextjs";
import * as z from "zod";

type Params = {
  writer: UIMessageStreamWriter<MyUIMessage>;
};

export const createCreateDataset = ({
  writer,
  chatId,
  token,
}: Params & { chatId: Id<"chats">; token: string }) =>
  tool({
    name: "createDataset",
    description: nakafaCreateDataset(),
    inputSchema: createDatasetInputSchema,
    outputSchema: z.string(),
    execute: async ({ query, targetRows }, { toolCallId }) => {
      writer.write({
        id: toolCallId,
        type: "data-create-dataset",
        data: {
          query,
          targetRows,
          status: "loading",
        },
      });

      try {
        const { datasetId } = await fetchMutation(
          convexApi.datasets.mutations.createDataset,
          {
            chatId,
            query,
            targetRows,
          },
          { token }
        );

        writer.write({
          id: toolCallId,
          type: "data-create-dataset",
          data: { datasetId, query, targetRows, status: "done" },
        });
        return createOutput({ output: { datasetId, query, targetRows } });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        writer.write({
          id: toolCallId,
          type: "data-create-dataset",
          data: { query, targetRows, status: "error", error: errorMessage },
        });
        return createOutput({ output: { datasetId: "", query, targetRows } });
      }
    },
  });

function createOutput({ output }: { output: CreateDatasetOutput }): string {
  return dedentString(`
    <createDatasetOutput>
      <datasetId>${output.datasetId}</datasetId>
      <query>${output.query}</query>
      <targetRows>${output.targetRows}</targetRows>
    </createDatasetOutput>
  `);
}

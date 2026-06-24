import {
  PedagogyProjectionPersistenceMetadataSchema,
  PedagogyProjectionRepository,
} from "@repo/ai/nina/pedagogy/repo";
import type { PedagogyProjectionShape } from "@repo/ai/nina/pedagogy/schema";
import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("PedagogyProjectionRepository", () => {
  it("accepts non-canonical projection persistence through the default Adapter", async () => {
    await expect(
      Effect.runPromise(
        PedagogyProjectionRepository.save(
          projectionFixture(),
          Schema.decodeSync(PedagogyProjectionPersistenceMetadataSchema)({
            responseMessageIdentifier: "response-1",
            toolCallId: "tool-1",
          })
        ).pipe(Effect.provide(PedagogyProjectionRepository.Default))
      )
    ).resolves.toBeUndefined();
  });
});

/** Builds one schema-shaped projection for repository seam tests. */
function projectionFixture(): PedagogyProjectionShape {
  return {
    evidenceHash: "evidence:test",
    kind: "math-pedagogy-projection",
    locale: "id",
    model: {
      gatewayModelId: "google/gemini-3-flash",
      modelId: "nakafa-lite",
      promptVersion: "math.pedagogy.v1",
      provider: "ai-gateway",
      schemaVersion: "pedagogy.projection.v1",
    },
    narratedAt: 1,
    sentences: [
      {
        evidenceRefs: ["math:solve:repo:result:primary"],
        id: "math:solve:repo:pedagogy:0",
        text: "Kalimat ini hanya menjadi contoh proyeksi yang terikat bukti.",
      },
    ],
    workId: "math:solve:repo",
  };
}

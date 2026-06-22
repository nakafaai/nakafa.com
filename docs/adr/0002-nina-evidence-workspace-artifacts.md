# ADR 0002: Nina EvidenceWorkspace and Durable LearningArtifacts

Nina keeps one public `NinaHarness.stream` Interface, but internal LearningCapabilities coordinate through a typed per-turn `EvidenceWorkspace` instead of calling each other or treating AI SDK tool messages as product state. Durable renderable output is stored as schema-owned `LearningArtifact` data: chat parts persist only lightweight `data-artifact` manifests, while full payloads live behind a deep `ArtifactPersistence` Convex Module that owns auth, indexes, size budgets, deletes, and integrity checks.

This rejects two tempting shortcuts: adding more optional fields to the existing flattened `parts` table, and persisting model-authored renderer instructions or dense point clouds as mathematical truth. The chosen shape preserves transcript pagination, keeps artifact payload growth local, and lets deterministic CAS/math evidence own coordinate-system rendering contracts.

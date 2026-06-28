import {
  createAssetRecord,
  createAssetRegistry,
} from "@repo/contents/_types/asset/projection";

/**
 * Asset registry Interface for generated source inputs.
 *
 * The Module intentionally has no handwritten data rows. Callers pass decoded
 * source facts from MDX metadata, Material sources, or future generated sidecars;
 * this registry owns the canonical grouping and validation contract.
 */
export const AssetRegistry = {
  createRecord: createAssetRecord,
  createRegistry: createAssetRegistry,
};

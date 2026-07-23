import {
  type RendererCapability,
  type RendererComponentRequirement,
  sortRendererComponentRequirements,
} from "@nakafa/aksara-contracts/renderer/component";
import type { RendererDomainCapability } from "@nakafa/aksara-contracts/renderer/contract";
import type { RendererDomain } from "@nakafa/aksara-contracts/renderer/domain";

/** Independent compiler selection and runtime support for one registry. */
interface RendererCapabilityInput {
  readonly authoringComponents: readonly RendererComponentRequirement[];
  readonly supportedComponents: readonly RendererComponentRequirement[];
}

/** Assigns one contract version to checked physical component names. */
export function createComponentRequirements(
  componentNames: readonly string[],
  version: number
) {
  return [...componentNames].sort().map((name) => ({ name, version }));
}

/** Canonicalizes independent authoring and supported renderer versions. */
export function createComponentCapability({
  authoringComponents,
  supportedComponents,
}: RendererCapabilityInput): RendererCapability {
  return {
    authoringComponents: sortRendererComponentRequirements(authoringComponents),
    supportedComponents: sortRendererComponentRequirements(supportedComponents),
  };
}

/** Creates one canonical route-domain capability from independent versions. */
export function createDomainCapability(
  name: RendererDomain,
  input: RendererCapabilityInput
): RendererDomainCapability {
  return {
    name,
    ...createComponentCapability(input),
  };
}

import type { LearningCapabilityName } from "@repo/backend/confect/nina/capability/spec";
import {
  type Card,
  crashed,
  denied,
  type Part,
  ran,
  stored,
} from "./message";

/**
 * Every way a capability ends short of a plain answer: a part for each outcome
 * the contract names (`partial`, `empty`, `limit`, `failed`), the refusal of
 * the policy, and a crash with no card. Each part that keeps a card keeps `card`.
 * `limit` says whether the capability can end at its limit. Only the two that
 * send links can: `confect/nina/nakafa/agent.ts` and
 * `confect/nina/research/capability.ts` answer `limit`, and math never does.
 */
export function outcomes(
  capability: LearningCapabilityName,
  card: Card,
  { limit }: { readonly limit: boolean }
): readonly Part[] {
  return [
    ran(capability, `${capability}-partial`, stored([card], "partial")),
    ran(capability, `${capability}-empty`, stored([card], "empty")),
    ...(limit
      ? [ran(capability, `${capability}-limit`, stored([card], "limit"))]
      : []),
    ran(capability, `${capability}-failed`, stored([card], "failed")),
    denied(capability, `${capability}-denied`),
    crashed(capability, `${capability}-crashed`),
  ];
}

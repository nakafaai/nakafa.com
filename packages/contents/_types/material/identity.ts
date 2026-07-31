import {
  type Material,
  SUBJECT_MATERIALS,
} from "@repo/contents/_types/taxonomy";

/** Reads the subject domain encoded by one stable lesson material key. */
export function readMaterialDomain(materialKey: string): Material | undefined {
  const [kind, domain, topic, extra] = materialKey.split(".");
  if (kind !== "lesson" || !domain || !topic || extra !== undefined) {
    return;
  }
  return SUBJECT_MATERIALS.find((candidate) => candidate === domain);
}

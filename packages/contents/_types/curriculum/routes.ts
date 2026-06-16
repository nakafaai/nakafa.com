import {
  listCurriculumNodes,
  type ProjectedCurriculumNode,
} from "@repo/contents/_types/curriculum/projection";
import type { CurriculumSource } from "@repo/contents/_types/curriculum/schema";
import { listLessonMaterialSources } from "@repo/contents/_types/material/registry";
import type { LessonMaterialSource } from "@repo/contents/_types/material/schema";
import type {
  Grade,
  Material,
  SubjectCategory,
} from "@repo/contents/_types/taxonomy";

interface CurriculumRouteInputs {
  curricula?: readonly CurriculumSource[];
  curriculumNodes?: readonly ProjectedCurriculumNode[];
  materials?: readonly LessonMaterialSource[];
}

interface CurriculumPlacement {
  category: SubjectCategory;
  grade: Grade;
  material: Material;
  materialKey: string;
  order: number;
}

interface CurriculumPlacementSource extends CurriculumPlacement {
  materialSource: LessonMaterialSource;
}

interface CurriculumCategoryParam {
  category: SubjectCategory;
}

interface CurriculumGradeParam extends CurriculumCategoryParam {
  grade: Grade;
}

interface CurriculumMaterialParam extends CurriculumGradeParam {
  material: Material;
}

interface CurriculumLessonParam extends CurriculumMaterialParam {
  slug: string[];
}

const CLASS_KEY_PATTERN = /^class-(10|11|12)$/;

/** Lists curriculum category route params from curriculum-owned material mappings. */
export function listCurriculumCategoryParams(
  inputs: CurriculumRouteInputs = {}
): CurriculumCategoryParam[] {
  return uniqueParams(
    listSchoolCurriculumPlacements(inputs).map(({ category }) => ({
      category,
    }))
  );
}

/** Lists curriculum grade route params from curriculum-owned material mappings. */
export function listCurriculumGradeParams(
  inputs: CurriculumRouteInputs = {}
): CurriculumGradeParam[] {
  return uniqueParams(
    listSchoolCurriculumPlacements(inputs).map(({ category, grade }) => ({
      category,
      grade,
    }))
  );
}

/** Lists curriculum subject route params from curriculum-owned material mappings. */
export function listCurriculumMaterialParams(
  inputs: CurriculumRouteInputs = {}
): CurriculumMaterialParam[] {
  return uniqueParams(
    listSchoolCurriculumPlacements(inputs).map(
      ({ category, grade, material }) => ({
        category,
        grade,
        material,
      })
    )
  );
}

/** Lists curriculum lesson route params from material sections placed by curricula. */
export function listCurriculumLessonParams(
  inputs: CurriculumRouteInputs = {}
): CurriculumLessonParam[] {
  return uniqueParams(
    listSchoolCurriculumPlacementSources(inputs).flatMap((placement) =>
      placement.materialSource.sections.map((section) => ({
        category: placement.category,
        grade: placement.grade,
        material: placement.material,
        slug: [placement.materialSource.slug, section.slug],
      }))
    )
  );
}

/** Lists current school-curriculum placements without reading filesystem routes. */
export function listSchoolCurriculumPlacements(
  inputs: CurriculumRouteInputs = {}
): CurriculumPlacement[] {
  return listSchoolCurriculumPlacementSources(inputs).map(
    ({ materialSource: _materialSource, ...placement }) => placement
  );
}

function listSchoolCurriculumPlacementSources(
  inputs: CurriculumRouteInputs
): CurriculumPlacementSource[] {
  const curriculumNodes = getProjectedCurriculumNodes(inputs);
  const materialByKey = createMaterialByKey(inputs.materials);
  const nodeByKey = new Map(
    curriculumNodes.map((node) => [getProjectedNodeMapKey(node), node])
  );
  const placements: CurriculumPlacementSource[] = [];

  for (const node of curriculumNodes) {
    if (node.materialKeys.length === 0) {
      continue;
    }

    const classNode = findAncestorNode(nodeByKey, node, "class");
    const grade = getHighSchoolGrade(classNode?.key);

    if (!grade) {
      continue;
    }

    for (const materialKey of node.materialKeys) {
      const material = materialByKey.get(materialKey);

      if (!material) {
        continue;
      }

      placements.push({
        category: "high-school",
        grade,
        material: material.domain,
        materialKey,
        materialSource: material,
        order: node.order,
      });
    }
  }

  return placements;
}

function getProjectedCurriculumNodes(inputs: CurriculumRouteInputs) {
  if (inputs.curriculumNodes) {
    return inputs.curriculumNodes;
  }

  if (!(inputs.curricula || inputs.materials)) {
    return listCurriculumNodes();
  }

  return listCurriculumNodes({
    curricula: inputs.curricula,
    materials: inputs.materials,
  });
}

function createMaterialByKey(
  materials: readonly LessonMaterialSource[] = listLessonMaterialSources()
) {
  return new Map(materials.map((material) => [material.key, material]));
}

function findAncestorNode(
  nodeByKey: ReadonlyMap<string, ProjectedCurriculumNode>,
  node: ProjectedCurriculumNode,
  level: ProjectedCurriculumNode["level"]
) {
  let current: ProjectedCurriculumNode | undefined = node;

  while (current) {
    if (current.level === level) {
      return current;
    }

    current = current.parentKey
      ? nodeByKey.get(`${current.curriculumKey}:${current.parentKey}`)
      : undefined;
  }

  return null;
}

function getProjectedNodeMapKey(node: ProjectedCurriculumNode) {
  return `${node.curriculumKey}:${node.key}`;
}

function getHighSchoolGrade(key?: string): Grade | null {
  const grade = key?.match(CLASS_KEY_PATTERN)?.[1];

  if (grade === "10" || grade === "11" || grade === "12") {
    return grade;
  }

  return null;
}

function uniqueParams<T>(params: readonly T[]) {
  const byKey = new Map<string, T>();

  for (const param of params) {
    byKey.set(JSON.stringify(param), param);
  }

  return Array.from(byKey.values());
}

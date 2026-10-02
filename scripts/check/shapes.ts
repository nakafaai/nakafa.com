import { Array as Arr } from "effect";
import {
  isArrayTypeNode,
  isDeclareKeyword,
  isInterfaceDeclaration,
  isIntersectionTypeNode,
  isModuleDeclaration,
  isNamedTupleMember,
  isOptionalTypeNode,
  isParenthesizedTypeNode,
  isRestTypeNode,
  isSourceFile,
  isTupleTypeNode,
  isTypeAliasDeclaration,
  isTypeLiteralNode,
  isTypeOperatorNode,
  isTypeReferenceNode,
  isUnionTypeNode,
  type Node,
  type SourceFile,
  type TypeNode,
} from "typescript/unstable/ast";
import { candidate } from "#scripts/check/rules";

const JSX_PATTERN = /\.tsx$/u;
const PROPS_PATTERN = /Props$/u;

/**
 * Whether a type spells out an object literal, directly or through a union,
 * intersection, array, tuple, `readonly`, or a type argument such as
 * `Readonly<{ ... }>`.
 */
function spellsObject(type: TypeNode): boolean {
  if (isTypeLiteralNode(type)) {
    return true;
  }
  if (
    isParenthesizedTypeNode(type) ||
    isTypeOperatorNode(type) ||
    isOptionalTypeNode(type) ||
    isRestTypeNode(type) ||
    isNamedTupleMember(type)
  ) {
    return spellsObject(type.type);
  }
  if (isArrayTypeNode(type)) {
    return spellsObject(type.elementType);
  }
  if (isUnionTypeNode(type) || isIntersectionTypeNode(type)) {
    return Arr.some(type.types, spellsObject);
  }
  if (isTupleTypeNode(type)) {
    return Arr.some(type.elements, spellsObject);
  }
  return (
    isTypeReferenceNode(type) &&
    Arr.some(type.typeArguments ?? [], spellsObject)
  );
}

/**
 * Whether a declaration sits inside `declare module` or `declare global`,
 * where it augments a framework or platform type that no Schema can own.
 */
function isAmbient(node: Node): boolean {
  const { parent } = node;
  if (isSourceFile(parent)) {
    return false;
  }
  return (
    (isModuleDeclaration(parent) &&
      Arr.some(parent.modifiers ?? [], isDeclareKeyword)) ||
    isAmbient(parent)
  );
}

/**
 * Returns the hand-written data shapes among one module's `nodes`: interfaces
 * that declare their own members and type aliases that spell out an object.
 * React component props in `.tsx` modules, ambient augmentations, and
 * interfaces that only extend a derived type stay allowed.
 */
export function shapeCandidates(
  file: string,
  sourceFile: SourceFile,
  nodes: readonly Node[]
) {
  const props = JSX_PATTERN.test(file);
  return Arr.flatMap(nodes, (node) => {
    if (!(isInterfaceDeclaration(node) || isTypeAliasDeclaration(node))) {
      return [];
    }
    const handWritten = isInterfaceDeclaration(node)
      ? !Arr.isReadonlyArrayEmpty(node.members) ||
        node.heritageClauses === undefined
      : spellsObject(node.type);
    const allowed =
      (props && PROPS_PATTERN.test(node.name.text)) || isAmbient(node);
    return handWritten && !allowed
      ? [candidate("data-type", sourceFile, node.name)]
      : [];
  });
}

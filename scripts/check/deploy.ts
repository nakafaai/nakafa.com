import { Array as Arr, Option } from "effect";
import {
  type Expression,
  isIdentifier,
  isObjectLiteralExpression,
  isPropertyAssignment,
  isStringLiteralLikeNode,
  isVariableStatement,
  type ObjectLiteralExpression,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";

/** The Vercel project configuration of one app. */
const VERCEL_CONFIG_PATTERN = /^apps\/[^/]+\/vercel\.ts$/u;
const RULE =
  'set git.deploymentEnabled of the exported config to { "**": false, main: true }, so only the main branch deploys and Vercel creates no Preview deployment';

/** Returns the value that an object literal gives the property `name`, when it writes it as a plain property. */
function property(
  object: ObjectLiteralExpression,
  name: string
): Option.Option<Expression> {
  return Arr.findFirst(object.properties, (member) =>
    isPropertyAssignment(member) &&
    (isIdentifier(member.name) || isStringLiteralLikeNode(member.name)) &&
    member.name.text === name
      ? Option.some(member.initializer)
      : Option.none()
  );
}

/** Returns the object literal that an object literal gives the property `name`. */
function objectProperty(object: ObjectLiteralExpression, name: string) {
  return Option.filter(property(object, name), isObjectLiteralExpression);
}

/** Returns the object literal that a module's `config` variable holds. */
function configObject(sourceFile: SourceFile) {
  return Arr.findFirst(sourceFile.statements, (statement) =>
    isVariableStatement(statement)
      ? Arr.findFirst(statement.declarationList.declarations, (declaration) =>
          isIdentifier(declaration.name) &&
          declaration.name.text === "config" &&
          declaration.initializer !== undefined &&
          isObjectLiteralExpression(declaration.initializer)
            ? Option.some(declaration.initializer)
            : Option.none()
        )
      : Option.none()
  );
}

/** Whether a deployment policy is exactly `{ "**": false, main: true }`. */
function deploysMainOnly(policy: ObjectLiteralExpression) {
  return (
    policy.properties.length === 2 &&
    Option.exists(
      property(policy, "**"),
      ({ kind }) => kind === SyntaxKind.FalseKeyword
    ) &&
    Option.exists(
      property(policy, "main"),
      ({ kind }) => kind === SyntaxKind.TrueKeyword
    )
  );
}

/**
 * Reports a Vercel project configuration that lets a branch other than `main`
 * deploy. Each Vercel project reads its own `vercel.ts`, and the Python app
 * cannot import a shared value, so every file states the policy itself and
 * this check keeps the files equal.
 */
export function inspectDeploySource(
  file: string,
  sourceFile: SourceFile
): readonly string[] {
  if (!VERCEL_CONFIG_PATTERN.test(file)) {
    return [];
  }
  const policy = configObject(sourceFile).pipe(
    Option.flatMap((config) => objectProperty(config, "git")),
    Option.flatMap((git) => objectProperty(git, "deploymentEnabled"))
  );
  return Option.exists(policy, deploysMainOnly) ? [] : [`${file}: ${RULE}.`];
}

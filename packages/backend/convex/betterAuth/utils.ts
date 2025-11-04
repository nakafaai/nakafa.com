/**
 * Permissions structure: Record<string, string[]>
 * Maps resource names to arrays of allowed actions.
 */
export type Permissions = Record<string, string[]>;

/**
 * Validate API key permissions against required permissions.
 * Both params should be JSON stringified Record<string, string[]>.
 */
export function validatePermissions({
  requiredPerms,
  keyPerms,
}: {
  requiredPerms: string;
  keyPerms: string;
}): { valid: boolean; error?: string } {
  try {
    const required: Permissions = JSON.parse(requiredPerms);
    const keyPermissions: Permissions = JSON.parse(keyPerms);

    for (const [resource, actions] of Object.entries(required)) {
      const resourceActions = keyPermissions[resource];

      if (!resourceActions) {
        return {
          valid: false,
          error: `Missing permission for resource: ${resource}`,
        };
      }

      for (const action of actions) {
        if (!resourceActions.includes(action)) {
          return {
            valid: false,
            error: `Missing permission: ${resource}.${action}`,
          };
        }
      }
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid permissions format" };
  }
}

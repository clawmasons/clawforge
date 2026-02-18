/**
 * Subspace-level permission model for yjs-server.
 *
 * Permission string format: "<subspace>:<right>"
 *   - Root document: ":read" (empty subspace name)
 *   - Subspace: "prompts:write", "presence:observe", "internal.chat:read"
 *
 * Rights hierarchy: write > observe > read
 *   - write implies observe implies read
 */

export type Right = "read" | "observe" | "write";

export interface ParsedPermission {
  subspace: string;
  right: Right;
}

const VALID_RIGHTS: ReadonlySet<string> = new Set(["read", "observe", "write"]);

const RIGHT_LEVEL: Record<Right, number> = {
  read: 0,
  observe: 1,
  write: 2,
};

/**
 * Parse a permission string into subspace and right.
 * Format: "<subspace>:<right>" — root is ":read" (empty subspace).
 */
export function parsePermission(str: string): ParsedPermission {
  const colonIndex = str.lastIndexOf(":");
  if (colonIndex === -1) {
    throw new Error(`Malformed permission string (missing colon): "${str}"`);
  }
  const subspace = str.slice(0, colonIndex);
  const right = str.slice(colonIndex + 1);
  if (!VALID_RIGHTS.has(right)) {
    throw new Error(`Invalid right "${right}" in permission "${str}"`);
  }
  return { subspace, right: right as Right };
}

/**
 * Map from subspace name to the highest effective right.
 * Empty string key ("") represents the root document.
 */
export type ConnectionPermissions = Map<string, Right>;

/**
 * Build a permissions map from an array of permission strings.
 * Highest right wins per subspace (write > observe > read).
 */
export function buildPermissions(strings: string[]): ConnectionPermissions {
  const result: ConnectionPermissions = new Map();
  for (const str of strings) {
    const { subspace, right } = parsePermission(str);
    const existing = result.get(subspace);
    if (!existing || RIGHT_LEVEL[right] > RIGHT_LEVEL[existing]) {
      result.set(subspace, right);
    }
  }
  return result;
}

/**
 * Check whether permissions grant at least the requested right on a subspace.
 * Returns true if the effective right >= the requested right in the hierarchy.
 */
export function hasRight(
  permissions: ConnectionPermissions,
  subspace: string,
  right: Right,
): boolean {
  const effective = permissions.get(subspace);
  if (!effective) return false;
  return RIGHT_LEVEL[effective] >= RIGHT_LEVEL[right];
}

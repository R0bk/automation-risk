export const ORG_FLOW_NODE_WIDTH = 260;
export const ORG_FLOW_NODE_DEFAULT_HEIGHT = 240;

export const DENSE_NODE_BASE_HEIGHT = 188;
export const DENSE_ROLE_ROW_HEIGHT = 44;
export const DENSE_ROLE_ROW_GAP = 4;
export const DENSE_ROLE_GROUP_HEADER_HEIGHT = 28;

export function getDenseNodePreferredHeight(roleCount: number, groupCount = 1): number {
  const safeRoleCount = Math.max(0, roleCount);
  const safeGroupCount = Math.max(1, groupCount);

  const rowsHeight = safeRoleCount * DENSE_ROLE_ROW_HEIGHT;
  const gapsHeight = safeRoleCount > 0 ? (safeRoleCount - 1) * DENSE_ROLE_ROW_GAP : 0;
  const groupStackHeight = (safeGroupCount - 1) * DENSE_ROLE_GROUP_HEADER_HEIGHT;

  return DENSE_NODE_BASE_HEIGHT + rowsHeight + gapsHeight + groupStackHeight;
}

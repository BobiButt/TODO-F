// ============================================================================
// FILE:       frontend/src/utils/dates.ts
// PURPOSE:    Date and time helper routines: relative time formatting (e.g. "5m ago"),
//             full tooltip timestamps, and overdue/due-today/due-soon deadline calculations.
// HOW IT WORKS: Compares ISO timestamp strings against current client time.
// USED BY / DEPENDS ON: TaskCard, TaskCardBadge, CommentThread, StatsWidget.
// KEY CONCEPTS: Time formatting, relative time calculation, deadline urgency.
// ============================================================================

/**
 * Format ISO datetime into relative human time string (e.g. "just now", "5m ago", "2h ago").
 *
 * @param {string} isoString - UTC ISO date string.
 * @returns {string} Relative time representation.
 */
export function formatRelativeTime(isoString: string): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "just now";
  }
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  // Format as short calendar date (e.g. "Oct 14").
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Format ISO datetime into detailed full string for hover tooltips.
 *
 * @param {string} isoString - UTC ISO date string.
 * @returns {string} Full human-readable timestamp.
 */
export function formatFullTimestamp(isoString: string): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Check if a task deadline is overdue (in the past and not completed).
 *
 * @param {string | null} dueDateStr - YYYY-MM-DD date string.
 * @param {string} status - Current task status ('pending', 'in_progress', 'completed').
 * @returns {boolean} True if overdue.
 */
export function isOverdue(dueDateStr: string | null, status: string): boolean {
  if (!dueDateStr || status === "completed") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDateStr + "T00:00:00");
  return due < today;
}

/**
 * Check if a task is due today.
 *
 * @param {string | null} dueDateStr - YYYY-MM-DD date string.
 * @param {string} status - Current task status.
 * @returns {boolean} True if due today and not completed.
 */
export function isDueToday(dueDateStr: string | null, status: string): boolean {
  if (!dueDateStr || status === "completed") return false;
  const today = new Date().toISOString().split("T")[0];
  return dueDateStr === today;
}

/**
 * Check if a task is due soon (within the next 48 hours).
 *
 * @param {string | null} dueDateStr - YYYY-MM-DD date string.
 * @param {string} status - Current task status.
 * @returns {boolean} True if due soon.
 */
export function isDueSoon(dueDateStr: string | null, status: string): boolean {
  if (!dueDateStr || status === "completed") return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const due = new Date(dueDateStr + "T00:00:00");
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return diffDays > 0 && diffDays <= 2;
}

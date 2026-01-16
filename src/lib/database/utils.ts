/**
 * Database Utilities
 *
 * Shared utility functions for database operations.
 * Single source of truth for common database helpers.
 */

import type { PromptRecord } from '../llm_api/types.js';

// =============================================================================
// Row Conversion Utilities
// =============================================================================

/**
 * Convert a database row to a PromptRecord object using column names
 *
 * This is the single source of truth for row-to-record conversion.
 * Used by both database initialization and prompt retrieval functions.
 *
 * @param row - Raw database row as array of values
 * @param columns - Array of column names from the query result
 * @returns PromptRecord object
 *
 * @example
 * ```typescript
 * const result = db.exec('SELECT * FROM hazo_prompts WHERE uuid = ?', [uuid]);
 * if (result.length > 0 && result[0].values.length > 0) {
 *   const record = row_to_prompt_record(result[0].values[0], result[0].columns);
 * }
 * ```
 */
export function row_to_prompt_record(row: unknown[], columns: string[]): PromptRecord {
  const record: Record<string, unknown> = {};

  for (let i = 0; i < columns.length; i++) {
    record[columns[i]] = row[i];
  }

  return {
    id: String(record.id || ''),
    prompt_area: String(record.prompt_area || ''),
    prompt_key: String(record.prompt_key || ''),
    local_1: record.local_1 != null ? String(record.local_1) : null,
    local_2: record.local_2 != null ? String(record.local_2) : null,
    local_3: record.local_3 != null ? String(record.local_3) : null,
    user_id: record.user_id != null ? String(record.user_id) : null,
    scope_id: record.scope_id != null ? String(record.scope_id) : null,
    prompt_text: String(record.prompt_text || ''),
    prompt_variables: String(record.prompt_variables || '[]'),
    prompt_notes: String(record.prompt_notes || ''),
    created_at: String(record.created_at || ''),
    changed_at: String(record.changed_at || ''),
  };
}

/**
 * Column indices for hazo_prompts table
 * Use these constants when building queries to ensure consistency
 */
export const PROMPT_COLUMNS = {
  ID: 0,
  PROMPT_AREA: 1,
  PROMPT_KEY: 2,
  LOCAL_1: 3,
  LOCAL_2: 4,
  LOCAL_3: 5,
  USER_ID: 6,
  SCOPE_ID: 7,
  PROMPT_TEXT: 8,
  PROMPT_VARIABLES: 9,
  PROMPT_NOTES: 10,
  CREATED_AT: 11,
  CHANGED_AT: 12,
} as const;

/**
 * SQL column names for hazo_prompts table
 */
export const PROMPT_COLUMN_NAMES = [
  'id',
  'prompt_area',
  'prompt_key',
  'local_1',
  'local_2',
  'local_3',
  'user_id',
  'scope_id',
  'prompt_text',
  'prompt_variables',
  'prompt_notes',
  'created_at',
  'changed_at',
] as const;

/**
 * Get the SELECT clause for all prompt columns
 * @returns SQL SELECT clause string
 */
export function get_prompt_select_clause(): string {
  return PROMPT_COLUMN_NAMES.join(', ');
}

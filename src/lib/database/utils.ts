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
 * const result = db.exec('SELECT * FROM prompts_library WHERE uuid = ?', [uuid]);
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
    uuid: String(record.uuid || ''),
    prompt_area: String(record.prompt_area || ''),
    prompt_key: String(record.prompt_key || ''),
    local_1: record.local_1 != null ? String(record.local_1) : null,
    local_2: record.local_2 != null ? String(record.local_2) : null,
    local_3: record.local_3 != null ? String(record.local_3) : null,
    prompt_text: String(record.prompt_text || ''),
    prompt_variables: String(record.prompt_variables || '[]'),
    prompt_notes: String(record.prompt_notes || ''),
    created_at: String(record.created_at || ''),
    changed_by: String(record.changed_by || ''),
  };
}

/**
 * Column indices for prompts_library table
 * Use these constants when building queries to ensure consistency
 */
export const PROMPT_COLUMNS = {
  UUID: 0,
  PROMPT_AREA: 1,
  PROMPT_KEY: 2,
  LOCAL_1: 3,
  LOCAL_2: 4,
  LOCAL_3: 5,
  PROMPT_TEXT: 6,
  PROMPT_VARIABLES: 7,
  PROMPT_NOTES: 8,
  CREATED_AT: 9,
  CHANGED_BY: 10,
} as const;

/**
 * SQL column names for prompts_library table
 */
export const PROMPT_COLUMN_NAMES = [
  'uuid',
  'prompt_area',
  'prompt_key',
  'local_1',
  'local_2',
  'local_3',
  'prompt_text',
  'prompt_variables',
  'prompt_notes',
  'created_at',
  'changed_by',
] as const;

/**
 * Get the SELECT clause for all prompt columns
 * @returns SQL SELECT clause string
 */
export function get_prompt_select_clause(): string {
  return PROMPT_COLUMN_NAMES.join(', ');
}

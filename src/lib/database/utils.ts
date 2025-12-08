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
  PROMPT_TEXT: 3,
  PROMPT_VARIABLES: 4,
  PROMPT_NOTES: 5,
  CREATED_AT: 6,
  CHANGED_BY: 7,
} as const;

/**
 * SQL column names for prompts_library table
 */
export const PROMPT_COLUMN_NAMES = [
  'uuid',
  'prompt_area',
  'prompt_key',
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

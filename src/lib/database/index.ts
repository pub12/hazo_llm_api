/**
 * Database Module Exports
 *
 * Export all database-related functions from this module
 */

export {
  initialize_database,
  get_database,
  close_database,
  insert_prompt,
  update_prompt,
  delete_prompt,
  // Path helpers
  get_default_sqlite_path,
  expand_path,
  resolve_sqlite_path,
} from './init_database.js';

export {
  row_to_prompt_record,
  PROMPT_COLUMNS,
  PROMPT_COLUMN_NAMES,
  get_prompt_select_clause,
} from './utils.js';


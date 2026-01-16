/**
 * Database Initialization Module
 * 
 * Initializes and manages the SQLite database for prompt storage.
 * Uses sql.js for database operations (pure JavaScript SQLite).
 * Creates the hazo_prompts table if it doesn't exist.
 */

import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import type { Logger, PromptRecord } from '../llm_api/types.js';
import { row_to_prompt_record } from './utils.js';

// =============================================================================
// Path Helpers
// =============================================================================

/**
 * Default SQLite database filename
 */
const DEFAULT_SQLITE_FILENAME = 'prompt_library.sqlite';

/**
 * Get the default SQLite database path
 * Returns an absolute path relative to the current working directory
 *
 * @returns Default database path: "{process.cwd()}/prompt_library.sqlite"
 *
 * @example
 * ```typescript
 * import { get_default_sqlite_path } from 'hazo_llm_api/server';
 *
 * const path = get_default_sqlite_path();
 * // Returns: "/path/to/your/app/prompt_library.sqlite"
 * ```
 */
export function get_default_sqlite_path(): string {
  return path.join(process.cwd(), DEFAULT_SQLITE_FILENAME);
}

/**
 * Expand tilde (~) in path to user's home directory
 * Also supports environment variables in the format ${VAR_NAME}
 *
 * @param file_path - Path that may contain ~ or environment variables
 * @returns Expanded path
 *
 * @example
 * ```typescript
 * import { expand_path } from 'hazo_llm_api/server';
 *
 * expand_path('~/data/prompts.db');
 * // Returns: "/Users/username/data/prompts.db"
 *
 * expand_path('${HOME}/data/prompts.db');
 * // Returns: "/Users/username/data/prompts.db"
 * ```
 */
export function expand_path(file_path: string): string {
  let expanded = file_path;

  // Expand tilde to home directory
  if (expanded.startsWith('~')) {
    expanded = path.join(os.homedir(), expanded.slice(1));
  }

  // Expand environment variables ${VAR_NAME}
  expanded = expanded.replace(/\$\{([^}]+)\}/g, (_, var_name) => {
    return process.env[var_name] || '';
  });

  // Also support $VAR_NAME format (common in Unix)
  expanded = expanded.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, var_name) => {
    return process.env[var_name] || '';
  });

  return expanded;
}

/**
 * Resolve a database path to an absolute path
 * Handles tilde expansion, environment variables, and relative paths
 *
 * @param sqlite_path - Path to resolve (can be relative, absolute, or contain ~/$VAR)
 * @returns Absolute path to the database file
 *
 * @example
 * ```typescript
 * import { resolve_sqlite_path } from 'hazo_llm_api/server';
 *
 * resolve_sqlite_path('prompt_library.sqlite');
 * // Returns: "/path/to/cwd/prompt_library.sqlite"
 *
 * resolve_sqlite_path('~/data/prompts.db');
 * // Returns: "/Users/username/data/prompts.db"
 *
 * resolve_sqlite_path('/absolute/path/prompts.db');
 * // Returns: "/absolute/path/prompts.db"
 * ```
 */
export function resolve_sqlite_path(sqlite_path: string): string {
  // First expand any special characters
  const expanded = expand_path(sqlite_path);

  // Then resolve to absolute path if needed
  return path.isAbsolute(expanded)
    ? expanded
    : path.join(process.cwd(), expanded);
}

// =============================================================================
// Database Instance
// =============================================================================

let db_instance: SqlJsDatabase | null = null;
let db_path: string | null = null;
let sql_initialized = false;

// =============================================================================
// Database Initialization
// =============================================================================

/**
 * Initialize the SQLite database connection and create tables if needed
 * @param sqlite_path - Path to the SQLite database file (relative to app root)
 * @param logger - Logger instance for logging operations
 * @returns Database instance
 */
export async function initialize_database(
  sqlite_path: string,
  logger: Logger
): Promise<SqlJsDatabase> {
  const file_name = 'init_database.ts';
  
  // Return existing instance if already initialized
  if (db_instance) {
    logger.debug('Database already initialized, returning existing instance', {
      file: file_name,
      line: 36,
    });
    return db_instance;
  }
  
  try {
    // Initialize sql.js
    if (!sql_initialized) {
      await initSqlJs();
      sql_initialized = true;
    }
    
    // Resolve database path relative to process.cwd() (consuming app root)
    const resolved_path = path.isAbsolute(sqlite_path)
      ? sqlite_path
      : path.join(process.cwd(), sqlite_path);
    
    db_path = resolved_path;
    
    logger.info('Initializing SQLite database', {
      file: file_name,
      line: 56,
      data: { path: resolved_path },
    });
    
    // Check if database file exists
    let file_buffer: Buffer | null = null;
    try {
      if (fs.existsSync(resolved_path)) {
        file_buffer = fs.readFileSync(resolved_path);
        logger.debug('Loading existing database file', {
          file: file_name,
          line: 66,
          data: { path: resolved_path },
        });
      }
    } catch {
      // File doesn't exist, will create new database
      logger.debug('Database file does not exist, will create new', {
        file: file_name,
        line: 73,
        data: { path: resolved_path },
      });
    }
    
    // Create database connection
    const SQL = await initSqlJs();
    db_instance = file_buffer 
      ? new SQL.Database(file_buffer)
      : new SQL.Database();
    
    // Create hazo_prompts table if it doesn't exist
    create_prompts_table(db_instance, logger);
    
    // Save database to file
    save_database(logger);
    
    logger.info('Database initialized successfully', {
      file: file_name,
      line: 92,
      data: { path: resolved_path },
    });
    
    return db_instance;
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to initialize database', {
      file: file_name,
      line: 100,
      data: { error: error_message, sqlite_path },
    });
    throw error;
  }
}

/**
 * Initialize database synchronously (for use in already async contexts)
 * Note: This should only be called after initialize_database has been called once
 */
export function initialize_database_sync(
  sqlite_path: string,
  logger: Logger
): SqlJsDatabase | null {
  // If already initialized, return the instance
  if (db_instance) {
    return db_instance;
  }
  
  // Otherwise, we need to initialize asynchronously first
  logger.warn('Database not initialized. Call initialize_database first.', {
    file: 'init_database.ts',
    line: 120,
  });
  
  return null;
}

// =============================================================================
// Table Creation
// =============================================================================

/**
 * Create the hazo_prompts table if it doesn't exist
 * @param db - Database instance
 * @param logger - Logger instance
 */
function create_prompts_table(db: SqlJsDatabase, logger: Logger): void {
  const file_name = 'init_database.ts';

  const create_table_sql = `
    CREATE TABLE IF NOT EXISTS hazo_prompts (
      id TEXT PRIMARY KEY,
      prompt_area TEXT NOT NULL,
      prompt_key TEXT NOT NULL,
      local_1 TEXT DEFAULT NULL,
      local_2 TEXT DEFAULT NULL,
      local_3 TEXT DEFAULT NULL,
      user_id TEXT DEFAULT NULL,
      scope_id TEXT DEFAULT NULL,
      prompt_text TEXT NOT NULL,
      prompt_variables TEXT DEFAULT '[]',
      prompt_notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      changed_at TEXT DEFAULT NULL
    )
  `;

  try {
    db.run(create_table_sql);

    // Migrate existing tables: add local_1, local_2, local_3, user_id, scope_id columns if they don't exist
    migrate_add_optional_columns(db, logger);

    // Migrate: rename changed_by to changed_at for existing databases
    migrate_rename_changed_by_to_changed_at(db, logger);

    // Create index for faster lookups by prompt_area, prompt_key, and filters
    const create_index_sql = `
      CREATE INDEX IF NOT EXISTS idx_prompts_area_key
      ON hazo_prompts(prompt_area, prompt_key, local_1, local_2, local_3, user_id, scope_id)
    `;
    db.run(create_index_sql);

    logger.debug('hazo_prompts table created/verified', {
      file: file_name,
      line: 164,
    });
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to create hazo_prompts table', {
      file: file_name,
      line: 170,
      data: { error: error_message },
    });
    throw error;
  }
}

/**
 * Migrate existing database: add optional columns if they don't exist
 * Handles: local_1, local_2, local_3, user_id, scope_id
 * @param db - Database instance
 * @param logger - Logger instance
 */
function migrate_add_optional_columns(db: SqlJsDatabase, logger: Logger): void {
  const file_name = 'init_database.ts';

  // Define columns to migrate with their SQL definitions
  const columns_to_add = [
    { name: 'local_1', sql: 'ALTER TABLE hazo_prompts ADD COLUMN local_1 TEXT DEFAULT NULL' },
    { name: 'local_2', sql: 'ALTER TABLE hazo_prompts ADD COLUMN local_2 TEXT DEFAULT NULL' },
    { name: 'local_3', sql: 'ALTER TABLE hazo_prompts ADD COLUMN local_3 TEXT DEFAULT NULL' },
    { name: 'user_id', sql: 'ALTER TABLE hazo_prompts ADD COLUMN user_id TEXT DEFAULT NULL' },
    { name: 'scope_id', sql: 'ALTER TABLE hazo_prompts ADD COLUMN scope_id TEXT DEFAULT NULL' },
  ];

  try {
    // Check existing columns
    const table_info = db.exec("PRAGMA table_info(hazo_prompts)");
    if (table_info.length === 0) {
      return; // Table doesn't exist yet
    }

    const existing_columns = table_info[0].values.map(row => row[1] as string);

    // Add each missing column
    for (const column of columns_to_add) {
      if (!existing_columns.includes(column.name)) {
        db.run(column.sql);
        logger.info(`Migration: Added ${column.name} column to hazo_prompts`, {
          file: file_name,
        });
      }
    }
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    logger.warn('Migration warning (may be harmless)', {
      file: file_name,
      data: { error: error_message },
    });
  }
}

/**
 * Migrate existing database: rename changed_by column to changed_at
 * This migration supports SQLite 3.25+ which added ALTER TABLE RENAME COLUMN
 * @param db - Database instance
 * @param logger - Logger instance
 */
function migrate_rename_changed_by_to_changed_at(db: SqlJsDatabase, logger: Logger): void {
  const file_name = 'init_database.ts';

  try {
    // Check existing columns
    const table_info = db.exec("PRAGMA table_info(hazo_prompts)");
    if (table_info.length === 0) {
      return; // Table doesn't exist yet
    }

    const existing_columns = table_info[0].values.map(row => row[1] as string);

    // Only migrate if changed_by exists but changed_at does not
    if (existing_columns.includes('changed_by') && !existing_columns.includes('changed_at')) {
      db.run('ALTER TABLE hazo_prompts RENAME COLUMN changed_by TO changed_at');
      logger.info('Migration: Renamed changed_by column to changed_at in hazo_prompts', {
        file: file_name,
      });
    }
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    logger.warn('Migration warning: Could not rename changed_by to changed_at', {
      file: file_name,
      data: { error: error_message },
    });
  }
}

// =============================================================================
// Database Operations
// =============================================================================

/**
 * Get the current database instance
 * @returns Database instance or null if not initialized
 */
export function get_database(): SqlJsDatabase | null {
  return db_instance;
}

/**
 * Save the database to file
 * @param logger - Logger instance
 */
export function save_database(logger: Logger): void {
  const file_name = 'init_database.ts';
  
  if (!db_instance || !db_path) {
    logger.warn('Cannot save database: not initialized', {
      file: file_name,
      line: 197,
    });
    return;
  }
  
  try {
    const data = db_instance.export();
    const buffer = Buffer.from(data);
    
    // Ensure directory exists
    const dir = path.dirname(db_path);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(db_path, buffer);
    
    logger.debug('Database saved to file', {
      file: file_name,
      line: 214,
      data: { path: db_path },
    });
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to save database', {
      file: file_name,
      line: 220,
      data: { error: error_message },
    });
  }
}

/**
 * Close the database connection
 * @param logger - Logger instance
 */
export function close_database(logger: Logger): void {
  const file_name = 'init_database.ts';
  
  if (db_instance) {
    try {
      // Save before closing
      save_database(logger);
      
      db_instance.close();
      db_instance = null;
      db_path = null;
      
      logger.info('Database connection closed', {
        file: file_name,
        line: 243,
      });
    } catch (error) {
      const error_message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to close database connection', {
        file: file_name,
        line: 249,
        data: { error: error_message },
      });
    }
  }
}

// =============================================================================
// Prompt CRUD Operations
// =============================================================================

/**
 * Insert a new prompt into the database
 * @param db - Database instance
 * @param prompt - Prompt data to insert
 * @param logger - Logger instance
 * @returns The inserted prompt record
 */
export function insert_prompt(
  db: SqlJsDatabase,
  prompt: Omit<PromptRecord, 'id' | 'created_at' | 'changed_at'>,
  logger: Logger
): PromptRecord {
  const file_name = 'init_database.ts';
  const id = randomUUID();

  const insert_sql = `
    INSERT INTO hazo_prompts (id, prompt_area, prompt_key, local_1, local_2, local_3, user_id, scope_id, prompt_text, prompt_variables, prompt_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  try {
    logger.debug('Inserting prompt into database', {
      file: file_name,
      line: 282,
      data: {
        id,
        prompt_area: prompt.prompt_area,
        prompt_key: prompt.prompt_key,
        local_1: prompt.local_1,
        local_2: prompt.local_2,
        local_3: prompt.local_3,
        user_id: prompt.user_id,
        scope_id: prompt.scope_id,
      },
    });

    db.run(insert_sql, [
      id,
      prompt.prompt_area,
      prompt.prompt_key,
      prompt.local_1 || null,
      prompt.local_2 || null,
      prompt.local_3 || null,
      prompt.user_id || null,
      prompt.scope_id || null,
      prompt.prompt_text,
      prompt.prompt_variables,
      prompt.prompt_notes,
    ]);
    
    // Save changes to file
    save_database(logger);
    
    // Fetch the inserted record
    const result = db.exec(
      'SELECT * FROM hazo_prompts WHERE id = ?',
      [id]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      throw new Error('Failed to retrieve inserted prompt');
    }

    const row = result[0].values[0];
    const columns = result[0].columns;

    const record = row_to_prompt_record(row, columns);

    logger.info('Prompt inserted successfully', {
      file: file_name,
      line: 318,
      data: { id, prompt_area: prompt.prompt_area, prompt_key: prompt.prompt_key },
    });
    
    return record;
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to insert prompt', {
      file: file_name,
      line: 326,
      data: { error: error_message, prompt_area: prompt.prompt_area, prompt_key: prompt.prompt_key },
    });
    throw error;
  }
}

/**
 * Update an existing prompt in the database
 * @param db - Database instance
 * @param id - ID (UUID) of the prompt to update
 * @param updates - Fields to update
 * @param logger - Logger instance
 * @returns The updated prompt record
 */
export function update_prompt(
  db: SqlJsDatabase,
  id: string,
  updates: Partial<Omit<PromptRecord, 'id' | 'created_at' | 'changed_at'>>,
  logger: Logger
): PromptRecord | null {
  const file_name = 'init_database.ts';
  
  // Build dynamic update SQL
  const fields: string[] = [];
  const values: (string | null)[] = [];

  if (updates.prompt_area !== undefined) {
    fields.push('prompt_area = ?');
    values.push(updates.prompt_area);
  }
  if (updates.prompt_key !== undefined) {
    fields.push('prompt_key = ?');
    values.push(updates.prompt_key);
  }
  if (updates.local_1 !== undefined) {
    fields.push('local_1 = ?');
    values.push(updates.local_1 || null);
  }
  if (updates.local_2 !== undefined) {
    fields.push('local_2 = ?');
    values.push(updates.local_2 || null);
  }
  if (updates.local_3 !== undefined) {
    fields.push('local_3 = ?');
    values.push(updates.local_3 || null);
  }
  if (updates.user_id !== undefined) {
    fields.push('user_id = ?');
    values.push(updates.user_id || null);
  }
  if (updates.scope_id !== undefined) {
    fields.push('scope_id = ?');
    values.push(updates.scope_id || null);
  }
  if (updates.prompt_text !== undefined) {
    fields.push('prompt_text = ?');
    values.push(updates.prompt_text);
  }
  if (updates.prompt_variables !== undefined) {
    fields.push('prompt_variables = ?');
    values.push(updates.prompt_variables);
  }
  if (updates.prompt_notes !== undefined) {
    fields.push('prompt_notes = ?');
    values.push(updates.prompt_notes);
  }
  
  if (fields.length === 0) {
    logger.warn('No fields to update', {
      file: file_name,
      line: 377,
      data: { id },
    });
    return null;
  }

  // Add changed_at timestamp
  fields.push("changed_at = datetime('now')");
  values.push(id);

  const update_sql = `
    UPDATE hazo_prompts
    SET ${fields.join(', ')}
    WHERE id = ?
  `;

  try {
    logger.debug('Updating prompt in database', {
      file: file_name,
      line: 395,
      data: { id, fields: Object.keys(updates) },
    });

    db.run(update_sql, values);

    // Save changes to file
    save_database(logger);

    // Fetch the updated record
    const result = db.exec(
      'SELECT * FROM hazo_prompts WHERE id = ?',
      [id]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      logger.warn('Prompt not found after update', {
        file: file_name,
        line: 412,
        data: { id },
      });
      return null;
    }

    const row = result[0].values[0];
    const columns = result[0].columns;

    const record = row_to_prompt_record(row, columns);

    logger.info('Prompt updated successfully', {
      file: file_name,
      line: 423,
      data: { id },
    });
    
    return record;
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to update prompt', {
      file: file_name,
      line: 431,
      data: { error: error_message, id },
    });
    throw error;
  }
}

/**
 * Delete a prompt from the database
 * @param db - Database instance
 * @param id - ID (UUID) of the prompt to delete
 * @param logger - Logger instance
 * @returns True if deleted successfully, false if not found
 */
export function delete_prompt(
  db: SqlJsDatabase,
  id: string,
  logger: Logger
): boolean {
  const file_name = 'init_database.ts';

  const delete_sql = `DELETE FROM hazo_prompts WHERE id = ?`;

  try {
    logger.debug('Deleting prompt from database', {
      file: file_name,
      line: 475,
      data: { id },
    });

    // Check if prompt exists first
    const check_result = db.exec(
      'SELECT id FROM hazo_prompts WHERE id = ?',
      [id]
    );

    if (check_result.length === 0 || check_result[0].values.length === 0) {
      logger.warn('Prompt not found for deletion', {
        file: file_name,
        line: 485,
        data: { id },
      });
      return false;
    }

    db.run(delete_sql, [id]);

    // Save changes to file
    save_database(logger);

    logger.info('Prompt deleted successfully', {
      file: file_name,
      line: 495,
      data: { id },
    });

    return true;
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to delete prompt', {
      file: file_name,
      line: 502,
      data: { error: error_message, id },
    });
    throw error;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================
// Note: row_to_prompt_record is now imported from ./utils.js for single source of truth

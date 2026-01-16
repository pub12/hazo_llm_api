/**
 * Prompt Retrieval Module
 *
 * Functions to retrieve prompts from the hazo_prompts database table.
 * Searches by prompt_area, prompt_key, and optional local filters.
 */

import type { Database as SqlJsDatabase } from 'sql.js';
import type { Logger, PromptRecord } from '../llm_api/types.js';
import { row_to_prompt_record } from '../database/utils.js';

// =============================================================================
// Local Filter Options Type
// =============================================================================

/**
 * Options for local filter fields when retrieving prompts
 */
export interface LocalFilterOptions {
  local_1?: string | null;
  local_2?: string | null;
  local_3?: string | null;
}

// =============================================================================
// Prompt Retrieval Functions
// =============================================================================

/**
 * Retrieve a prompt from the database by prompt_area and prompt_key
 * @param db - Database instance
 * @param prompt_area - Area/category of the prompt
 * @param prompt_key - Key identifier for the prompt
 * @param logger - Logger instance
 * @returns The prompt record if found, null otherwise
 */
export function get_prompt_by_area_and_key(
  db: SqlJsDatabase,
  prompt_area: string,
  prompt_key: string,
  logger: Logger
): PromptRecord | null {
  const file_name = 'get_prompt.ts';

  const select_sql = `
    SELECT * FROM hazo_prompts
    WHERE prompt_area = ? AND prompt_key = ?
    AND local_1 IS NULL AND local_2 IS NULL AND local_3 IS NULL
    LIMIT 1
  `;

  try {
    logger.debug('Retrieving prompt from database', {
      file: file_name,
      line: 62,
      data: { prompt_area, prompt_key },
    });

    const result = db.exec(select_sql, [prompt_area, prompt_key]);

    if (result.length === 0 || result[0].values.length === 0) {
      logger.warn('Prompt not found in database', {
        file: file_name,
        line: 71,
        data: { prompt_area, prompt_key },
      });
      return null;
    }

    const row = result[0].values[0];
    const columns = result[0].columns;
    const record = row_to_prompt_record(row, columns);

    logger.info('Prompt retrieved successfully', {
      file: file_name,
      line: 82,
      data: {
        id: record.id,
        prompt_area: record.prompt_area,
        prompt_key: record.prompt_key,
      },
    });

    return record;
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to retrieve prompt from database', {
      file: file_name,
      line: 94,
      data: { error: error_message, prompt_area, prompt_key },
    });
    throw error;
  }
}

/**
 * Retrieve a prompt from the database by prompt_area, prompt_key, and optional local filters
 * Uses fallback logic: tries most specific match first, then progressively less specific
 *
 * Fallback order:
 * 1. Exact match with all specified local filters
 * 2. Match with local_1 and local_2 only (if local_3 was specified)
 * 3. Match with local_1 only (if local_2 was specified)
 * 4. Match with no local filters (base prompt)
 *
 * @param db - Database instance
 * @param prompt_area - Area/category of the prompt
 * @param prompt_key - Key identifier for the prompt
 * @param locals - Optional local filter values
 * @param logger - Logger instance
 * @returns The prompt record if found, null otherwise
 */
export function get_prompt_by_area_key_and_locals(
  db: SqlJsDatabase,
  prompt_area: string,
  prompt_key: string,
  locals: LocalFilterOptions | null,
  logger: Logger
): PromptRecord | null {
  const file_name = 'get_prompt.ts';

  // If no locals provided, use the base function
  if (!locals || (!locals.local_1 && !locals.local_2 && !locals.local_3)) {
    return get_prompt_by_area_and_key(db, prompt_area, prompt_key, logger);
  }

  try {
    logger.debug('Retrieving prompt with local filters', {
      file: file_name,
      data: { prompt_area, prompt_key, locals },
    });

    // Build fallback queries from most specific to least specific
    const fallback_queries: Array<{ sql: string; params: (string | null)[]; description: string }> = [];

    // Level 1: All three locals specified
    if (locals.local_1 && locals.local_2 && locals.local_3) {
      fallback_queries.push({
        sql: `SELECT * FROM hazo_prompts
              WHERE prompt_area = ? AND prompt_key = ?
              AND local_1 = ? AND local_2 = ? AND local_3 = ?
              LIMIT 1`,
        params: [prompt_area, prompt_key, locals.local_1, locals.local_2, locals.local_3],
        description: 'all locals',
      });
    }

    // Level 2: local_1 and local_2 specified
    if (locals.local_1 && locals.local_2) {
      fallback_queries.push({
        sql: `SELECT * FROM hazo_prompts
              WHERE prompt_area = ? AND prompt_key = ?
              AND local_1 = ? AND local_2 = ? AND local_3 IS NULL
              LIMIT 1`,
        params: [prompt_area, prompt_key, locals.local_1, locals.local_2],
        description: 'local_1 and local_2',
      });
    }

    // Level 3: Only local_1 specified
    if (locals.local_1) {
      fallback_queries.push({
        sql: `SELECT * FROM hazo_prompts
              WHERE prompt_area = ? AND prompt_key = ?
              AND local_1 = ? AND local_2 IS NULL AND local_3 IS NULL
              LIMIT 1`,
        params: [prompt_area, prompt_key, locals.local_1],
        description: 'local_1 only',
      });
    }

    // Level 4: Base prompt (no locals)
    fallback_queries.push({
      sql: `SELECT * FROM hazo_prompts
            WHERE prompt_area = ? AND prompt_key = ?
            AND local_1 IS NULL AND local_2 IS NULL AND local_3 IS NULL
            LIMIT 1`,
      params: [prompt_area, prompt_key],
      description: 'base (no locals)',
    });

    // Try each query in order
    for (const query of fallback_queries) {
      const result = db.exec(query.sql, query.params);

      if (result.length > 0 && result[0].values.length > 0) {
        const row = result[0].values[0];
        const columns = result[0].columns;
        const record = row_to_prompt_record(row, columns);

        logger.info('Prompt retrieved with local filters', {
          file: file_name,
          data: {
            id: record.id,
            prompt_area: record.prompt_area,
            prompt_key: record.prompt_key,
            local_1: record.local_1,
            local_2: record.local_2,
            local_3: record.local_3,
            matched_level: query.description,
          },
        });

        return record;
      }
    }

    logger.warn('Prompt not found with local filters', {
      file: file_name,
      data: { prompt_area, prompt_key, locals },
    });
    return null;
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to retrieve prompt with local filters', {
      file: file_name,
      data: { error: error_message, prompt_area, prompt_key, locals },
    });
    throw error;
  }
}

/**
 * Retrieve the prompt text only by prompt_area and prompt_key
 * @param db - Database instance
 * @param prompt_area - Area/category of the prompt
 * @param prompt_key - Key identifier for the prompt
 * @param logger - Logger instance
 * @returns The prompt text if found, null otherwise
 */
export function get_prompt_text(
  db: SqlJsDatabase,
  prompt_area: string,
  prompt_key: string,
  logger: Logger
): string | null {
  const file_name = 'get_prompt.ts';
  
  const prompt_record = get_prompt_by_area_and_key(db, prompt_area, prompt_key, logger);
  
  if (prompt_record) {
    logger.debug('Prompt text retrieved', {
      file: file_name,
      line: 121,
      data: {
        prompt_area,
        prompt_key,
        text_length: prompt_record.prompt_text.length,
      },
    });
    return prompt_record.prompt_text;
  }
  
  return null;
}

/**
 * Get all prompts by prompt_area
 * @param db - Database instance
 * @param prompt_area - Area/category of the prompts
 * @param logger - Logger instance
 * @returns Array of prompt records
 */
export function get_prompts_by_area(
  db: SqlJsDatabase,
  prompt_area: string,
  logger: Logger
): PromptRecord[] {
  const file_name = 'get_prompt.ts';
  
  const select_sql = `
    SELECT * FROM hazo_prompts 
    WHERE prompt_area = ?
    ORDER BY prompt_key
  `;
  
  try {
    logger.debug('Retrieving prompts by area', {
      file: file_name,
      line: 157,
      data: { prompt_area },
    });
    
    const result = db.exec(select_sql, [prompt_area]);
    
    if (result.length === 0 || result[0].values.length === 0) {
      logger.info('No prompts found for area', {
        file: file_name,
        line: 165,
        data: { prompt_area },
      });
      return [];
    }
    
    const columns = result[0].columns;
    const records = result[0].values.map(row => row_to_prompt_record(row, columns));
    
    logger.info('Prompts retrieved by area', {
      file: file_name,
      line: 175,
      data: { prompt_area, count: records.length },
    });
    
    return records;
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to retrieve prompts by area', {
      file: file_name,
      line: 183,
      data: { error: error_message, prompt_area },
    });
    throw error;
  }
}

/**
 * Get a prompt by its ID (UUID)
 * @param db - Database instance
 * @param id - ID (UUID) of the prompt
 * @param logger - Logger instance
 * @returns The prompt record if found, null otherwise
 */
export function get_prompt_by_id(
  db: SqlJsDatabase,
  id: string,
  logger: Logger
): PromptRecord | null {
  const file_name = 'get_prompt.ts';

  const select_sql = `
    SELECT * FROM hazo_prompts
    WHERE id = ?
  `;

  try {
    logger.debug('Retrieving prompt by ID', {
      file: file_name,
      line: 211,
      data: { id },
    });

    const result = db.exec(select_sql, [id]);

    if (result.length === 0 || result[0].values.length === 0) {
      logger.warn('Prompt not found by ID', {
        file: file_name,
        line: 219,
        data: { id },
      });
      return null;
    }

    const row = result[0].values[0];
    const columns = result[0].columns;
    const record = row_to_prompt_record(row, columns);

    logger.info('Prompt retrieved by ID', {
      file: file_name,
      line: 229,
      data: { id },
    });

    return record;
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to retrieve prompt by ID', {
      file: file_name,
      line: 237,
      data: { error: error_message, id },
    });
    throw error;
  }
}

/**
 * Get all prompts from the library
 * @param db - Database instance
 * @param logger - Logger instance
 * @returns Array of all prompt records
 */
export function get_all_prompts(
  db: SqlJsDatabase,
  logger: Logger
): PromptRecord[] {
  const file_name = 'get_prompt.ts';
  
  const select_sql = `
    SELECT * FROM hazo_prompts 
    ORDER BY prompt_area, prompt_key
  `;
  
  try {
    logger.debug('Retrieving all prompts', {
      file: file_name,
      line: 265,
      data: {},
    });
    
    const result = db.exec(select_sql);
    
    if (result.length === 0 || result[0].values.length === 0) {
      logger.info('No prompts found in library', {
        file: file_name,
        line: 273,
        data: {},
      });
      return [];
    }
    
    const columns = result[0].columns;
    const records = result[0].values.map(row => row_to_prompt_record(row, columns));
    
    logger.info('All prompts retrieved', {
      file: file_name,
      line: 283,
      data: { count: records.length },
    });
    
    return records;
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to retrieve all prompts', {
      file: file_name,
      line: 291,
      data: { error: error_message },
    });
    throw error;
  }
}

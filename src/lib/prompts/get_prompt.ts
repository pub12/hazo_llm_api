/**
 * Prompt Retrieval Module
 *
 * Functions to retrieve prompts from the prompts_library database table.
 * Searches by prompt_area and prompt_key to find the prompt_text.
 */

import type { Database as SqlJsDatabase } from 'sql.js';
import type { Logger, PromptRecord } from '../llm_api/types.js';
import { row_to_prompt_record } from '../database/utils.js';

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
    SELECT * FROM prompts_library 
    WHERE prompt_area = ? AND prompt_key = ?
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
        uuid: record.uuid,
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
    SELECT * FROM prompts_library 
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
 * Get a prompt by its UUID
 * @param db - Database instance
 * @param uuid - UUID of the prompt
 * @param logger - Logger instance
 * @returns The prompt record if found, null otherwise
 */
export function get_prompt_by_uuid(
  db: SqlJsDatabase,
  uuid: string,
  logger: Logger
): PromptRecord | null {
  const file_name = 'get_prompt.ts';
  
  const select_sql = `
    SELECT * FROM prompts_library 
    WHERE uuid = ?
  `;
  
  try {
    logger.debug('Retrieving prompt by UUID', {
      file: file_name,
      line: 211,
      data: { uuid },
    });
    
    const result = db.exec(select_sql, [uuid]);
    
    if (result.length === 0 || result[0].values.length === 0) {
      logger.warn('Prompt not found by UUID', {
        file: file_name,
        line: 219,
        data: { uuid },
      });
      return null;
    }
    
    const row = result[0].values[0];
    const columns = result[0].columns;
    const record = row_to_prompt_record(row, columns);
    
    logger.info('Prompt retrieved by UUID', {
      file: file_name,
      line: 229,
      data: { uuid },
    });
    
    return record;
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to retrieve prompt by UUID', {
      file: file_name,
      line: 237,
      data: { error: error_message, uuid },
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
    SELECT * FROM prompts_library 
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

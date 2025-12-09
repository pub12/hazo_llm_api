/**
 * hazo_llm_text_text Function
 *
 * Text input → Text output
 * Standard text generation using LLM.
 * Supports static prompts, dynamic prompts from database, and variable substitution.
 */

import type { Database as SqlJsDatabase } from 'sql.js';
import type {
  TextTextParams,
  LLMResponse,
  LLMApiConfig,
} from './types.js';
import { get_prompt_text } from '../prompts/get_prompt.js';
import { substitute_variables } from '../prompts/substitute_variables.js';
import { SERVICE_TYPES } from '../providers/types.js';
import {
  get_validated_provider,
  log_api_start,
  log_api_complete,
  log_api_details,
  log_api_response,
  handle_caught_error,
} from './provider_helper.js';

// =============================================================================
// Constants
// =============================================================================

const FILE_NAME = 'hazo_llm_text_text.ts';
const API_NAME = 'text_text';

// =============================================================================
// hazo_llm_text_text Function
// =============================================================================

/**
 * Call the LLM with text input and get text output
 *
 * @param params - Text input parameters
 * @param db - Database instance for dynamic prompts
 * @param config - LLM API configuration
 * @param llm - Optional LLM provider name (uses primary LLM if not specified)
 * @returns LLM response with generated text
 */
export async function hazo_llm_text_text(
  params: TextTextParams,
  db: SqlJsDatabase | null,
  config: LLMApiConfig,
  llm?: string
): Promise<LLMResponse> {
  // Use default logger if not provided
  const { default_logger } = await import('./index.js');
  const logger = config.logger || default_logger;

  try {
    log_api_start(API_NAME, FILE_NAME, logger);

    // ==========================================================================
    // Step 1: Get the prompt text
    // ==========================================================================
    let prompt_text: string;

    if (params.prompt_area && params.prompt_key) {
      if (!db) {
        const error_msg = 'Database not initialized for dynamic prompt retrieval';
        logger.error(error_msg, { file: FILE_NAME });
        return { success: false, error: error_msg };
      }

      const dynamic_prompt = get_prompt_text(db, params.prompt_area, params.prompt_key, logger);

      if (!dynamic_prompt) {
        const error_msg = `Prompt not found for area="${params.prompt_area}" key="${params.prompt_key}"`;
        logger.error(error_msg, { file: FILE_NAME });
        return { success: false, error: error_msg };
      }

      prompt_text = dynamic_prompt;
    } else {
      prompt_text = params.prompt;
    }

    // ==========================================================================
    // Step 2: Substitute variables
    // ==========================================================================
    const final_prompt = substitute_variables(prompt_text, params.prompt_variables, logger);

    // ==========================================================================
    // Step 3: Get and validate provider
    // ==========================================================================
    const provider_result = get_validated_provider({
      llm,
      service_type: SERVICE_TYPES.TEXT_TEXT,
      logger,
    });

    if (!provider_result.success) {
      return provider_result.error_response;
    }

    const provider = provider_result.provider;

    log_api_details(provider, SERVICE_TYPES.TEXT_TEXT, FILE_NAME, logger, {
      prompt_text: final_prompt,
      llm_requested: llm || 'primary',
    });

    // ==========================================================================
    // Step 4: Call the provider
    // ==========================================================================
    const response = await provider.text_text(
      {
        ...params,
        prompt: final_prompt,
      },
      logger
    );

    log_api_response(response, FILE_NAME, logger);
    log_api_complete(API_NAME, FILE_NAME, response.success, logger);

    return response;
  } catch (error) {
    return handle_caught_error(error, 'hazo_llm_text_text', FILE_NAME, logger);
  }
}


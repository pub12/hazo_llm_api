/**
 * hazo_llm_text_image Function
 *
 * Text input → Image output
 * Generate an image from a text description/prompt.
 * Uses image generation capable models.
 */

import type { Database as SqlJsDatabase } from 'sql.js';
import type {
  TextImageParams,
  LLMResponse,
  LLMApiConfig,
} from './types.js';
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

const FILE_NAME = 'hazo_llm_text_image.ts';
const API_NAME = 'text_image';

// =============================================================================
// hazo_llm_text_image Function
// =============================================================================

/**
 * Call the LLM with text input and get image output
 *
 * @param params - Text input parameters for image generation
 * @param _db - Database instance (unused, kept for API consistency)
 * @param config - LLM API configuration
 * @param llm - Optional LLM provider name (uses primary LLM if not specified)
 * @returns LLM response with generated image data
 */
export async function hazo_llm_text_image(
  params: TextImageParams,
  _db: SqlJsDatabase | null,
  config: LLMApiConfig,
  llm?: string
): Promise<LLMResponse> {
  // Use default logger if not provided
  const { default_logger } = await import('./index.js');
  const logger = config.logger || default_logger;

  try {
    log_api_start(API_NAME, FILE_NAME, logger);

    // ==========================================================================
    // Step 1: Prepare prompt with variable substitution
    // ==========================================================================
    const final_prompt = substitute_variables(params.prompt, params.prompt_variables, logger);

    // ==========================================================================
    // Step 2: Get and validate provider
    // ==========================================================================
    const provider_result = get_validated_provider({
      llm,
      service_type: SERVICE_TYPES.TEXT_IMAGE,
      logger,
    });

    if (!provider_result.success) {
      return provider_result.error_response;
    }

    const provider = provider_result.provider;

    log_api_details(provider, SERVICE_TYPES.TEXT_IMAGE, FILE_NAME, logger, {
      prompt_text: final_prompt,
      llm_requested: llm || 'primary',
    });

    // ==========================================================================
    // Step 3: Call the provider
    // ==========================================================================
    const response = await provider.text_image(
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
    return handle_caught_error(error, 'hazo_llm_text_image', FILE_NAME, logger);
  }
}



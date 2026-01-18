/**
 * hazo_llm_image_text Function
 *
 * Image input → Text output
 * Analyze an image and get text description/response.
 * Supports image analysis, OCR, object detection descriptions, etc.
 */

import type { Database as SqlJsDatabase } from 'sql.js';
import type {
  ImageTextParams,
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

const FILE_NAME = 'hazo_llm_image_text.ts';
const API_NAME = 'image_text';

// =============================================================================
// hazo_llm_image_text Function
// =============================================================================

/**
 * Call the LLM with an image input and get text output
 *
 * @param params - Image input parameters
 * @param _db - Database instance (unused, kept for API consistency)
 * @param config - LLM API configuration
 * @param llm - Optional LLM provider name (uses primary LLM if not specified)
 * @returns LLM response with generated text description
 */
export async function hazo_llm_image_text(
  params: ImageTextParams,
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
    // Step 1: Validate image data
    // ==========================================================================
    if (!params.image_b64 || !params.image_mime_type) {
      const error_msg = 'image_b64 and image_mime_type are required';
      logger.error(error_msg, { file: FILE_NAME });
      return { success: false, error: error_msg };
    }

    // ==========================================================================
    // Step 2: Prepare prompt with variable substitution
    // ==========================================================================
    const final_prompt = substitute_variables(params.prompt, params.prompt_variables, logger);

    // ==========================================================================
    // Step 3: Get and validate provider
    // ==========================================================================
    const provider_result = get_validated_provider({
      llm,
      service_type: SERVICE_TYPES.IMAGE_TEXT,
      logger,
    });

    if (!provider_result.success) {
      return provider_result.error_response;
    }

    const provider = provider_result.provider;

    // Log with placeholder for base64 data (avoid logging full base64)
    const image_b64_length = params.image_b64?.length || 0;
    log_api_details(provider, SERVICE_TYPES.IMAGE_TEXT, FILE_NAME, logger, {
      prompt_text: final_prompt,
      image_mime_type: params.image_mime_type,
      image_b64: `[BASE64_DATA: ${image_b64_length} chars]`,
      llm_requested: llm || 'primary',
    });

    // ==========================================================================
    // Step 4: Call the provider
    // ==========================================================================
    const response = await provider.image_text(
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
    return handle_caught_error(error, 'hazo_llm_image_text', FILE_NAME, logger);
  }
}


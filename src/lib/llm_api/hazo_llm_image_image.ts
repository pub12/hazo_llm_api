/**
 * hazo_llm_image_image Function
 *
 * Image(s) input → Image output
 * Transform/edit/combine images based on text instructions.
 * Supports single or multiple input images.
 * Uses image generation capable models with input image(s).
 */

import type { Database as SqlJsDatabase } from 'sql.js';
import type {
  ImageImageParams,
  LLMResponse,
  LLMApiConfig,
  Base64Data,
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

const FILE_NAME = 'hazo_llm_image_image.ts';
const API_NAME = 'image_image';

// =============================================================================
// hazo_llm_image_image Function
// =============================================================================

/**
 * Call the LLM with image(s) input and get image output
 * Used for image editing, transformation, style transfer, combining images, etc.
 *
 * Supports two modes:
 * 1. Single image: Use image_b64 and image_mime_type
 * 2. Multiple images: Use images array
 *
 * @param params - Image input parameters with transformation instructions
 * @param _db - Database instance (unused, kept for API consistency)
 * @param config - LLM API configuration
 * @param llm - Optional LLM provider name (uses primary LLM if not specified)
 * @returns LLM response with transformed/generated image data
 */
export async function hazo_llm_image_image(
  params: ImageImageParams,
  _db: SqlJsDatabase | null,
  config: LLMApiConfig,
  llm?: string
): Promise<LLMResponse> {
  const logger = config.logger;

  try {
    log_api_start(API_NAME, FILE_NAME, logger);

    // ==========================================================================
    // Step 1: Validate and collect image data
    // ==========================================================================
    const images: Base64Data[] = [];

    if (params.images && params.images.length > 0) {
      images.push(...params.images);
    } else if (params.image_b64 && params.image_mime_type) {
      images.push({
        data: params.image_b64,
        mime_type: params.image_mime_type,
      });
    }

    if (images.length === 0) {
      const error_msg = 'At least one image is required. Provide image_b64/image_mime_type or images array.';
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
      service_type: SERVICE_TYPES.IMAGE_IMAGE,
      logger,
    });

    if (!provider_result.success) {
      return provider_result.error_response;
    }

    const provider = provider_result.provider;

    log_api_details(provider, SERVICE_TYPES.IMAGE_IMAGE, FILE_NAME, logger, {
      prompt_text: final_prompt,
      image_count: images.length,
      llm_requested: llm || 'primary',
    });

    // ==========================================================================
    // Step 4: Call the provider
    // ==========================================================================
    const response = await provider.image_image(
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
    return handle_caught_error(error, 'hazo_llm_image_image', FILE_NAME, logger);
  }
}


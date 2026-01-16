/**
 * hazo_llm_document_text Function
 *
 * Document input → Text output
 * Analyze a document (PDF) and get text description/response.
 * Supports document analysis, OCR, content extraction, summarization, etc.
 */

import type { Database as SqlJsDatabase } from 'sql.js';
import type {
  DocumentTextParams,
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

const FILE_NAME = 'hazo_llm_document_text.ts';
const API_NAME = 'document_text';

/**
 * Accepted document MIME types
 * Currently supports PDF only
 */
const DOCUMENT_MIME_TYPES = ['application/pdf'];

// =============================================================================
// hazo_llm_document_text Function
// =============================================================================

/**
 * Call the LLM with a document input and get text output
 *
 * @param params - Document input parameters
 * @param _db - Database instance (unused, kept for API consistency)
 * @param config - LLM API configuration
 * @param llm - Optional LLM provider name (uses primary LLM if not specified)
 * @returns LLM response with generated text analysis
 */
export async function hazo_llm_document_text(
  params: DocumentTextParams,
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
    // Step 1: Validate document data
    // ==========================================================================
    if (!params.document_b64 || !params.document_mime_type) {
      const error_msg = 'document_b64 and document_mime_type are required';
      logger.error(error_msg, { file: FILE_NAME });
      return { success: false, error: error_msg };
    }

    // ==========================================================================
    // Step 2: Validate MIME type
    // ==========================================================================
    if (!DOCUMENT_MIME_TYPES.includes(params.document_mime_type)) {
      const error_msg = `Unsupported document type: ${params.document_mime_type}. Supported types: ${DOCUMENT_MIME_TYPES.join(', ')}`;
      logger.error(error_msg, { file: FILE_NAME });
      return { success: false, error: error_msg };
    }

    // ==========================================================================
    // Step 3: Prepare prompt with variable substitution
    // ==========================================================================
    const final_prompt = substitute_variables(params.prompt, params.prompt_variables, logger);

    // ==========================================================================
    // Step 4: Get and validate provider
    // ==========================================================================
    const provider_result = get_validated_provider({
      llm,
      service_type: SERVICE_TYPES.DOCUMENT_TEXT,
      logger,
    });

    if (!provider_result.success) {
      return provider_result.error_response;
    }

    const provider = provider_result.provider;

    log_api_details(provider, SERVICE_TYPES.DOCUMENT_TEXT, FILE_NAME, logger, {
      prompt_text: final_prompt,
      document_mime_type: params.document_mime_type,
      max_pages: params.max_pages,
      llm_requested: llm || 'primary',
    });

    // ==========================================================================
    // Step 5: Call the provider
    // ==========================================================================
    const response = await provider.document_text(
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
    return handle_caught_error(error, 'hazo_llm_document_text', FILE_NAME, logger);
  }
}

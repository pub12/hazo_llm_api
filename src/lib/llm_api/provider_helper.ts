/**
 * Provider Helper Utilities
 *
 * Centralized helper functions for provider lookup, validation, and error handling.
 * Eliminates code duplication across service functions.
 */

import type { LLMProvider, ServiceType } from '../providers/types.js';
import type { Logger, LLMResponse } from './types.js';
import { get_provider, validate_capability } from '../providers/registry.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of provider validation - either success with provider or failure with error response
 */
export type ProviderValidationResult =
  | { success: true; provider: LLMProvider }
  | { success: false; error_response: LLMResponse };

/**
 * Options for provider validation
 */
export interface ProviderValidationOptions {
  /** LLM provider name (uses primary if not specified) */
  llm?: string;
  /** Service type to validate capability for */
  service_type: ServiceType;
  /** Logger instance */
  logger: Logger;
}

// =============================================================================
// Provider Validation Helper
// =============================================================================

/**
 * Get and validate a provider for a specific service type
 *
 * This function consolidates the provider lookup and capability validation
 * logic that was previously duplicated across all service functions.
 *
 * @param options - Validation options
 * @returns Provider if valid, or error response if not
 *
 * @example
 * ```typescript
 * const result = get_validated_provider({
 *   llm: 'gemini',
 *   service_type: SERVICE_TYPES.TEXT_TEXT,
 *   logger,
 * });
 *
 * if (!result.success) {
 *   return result.error_response;
 * }
 *
 * const response = await result.provider.text_text(params, logger);
 * ```
 */
export function get_validated_provider(
  options: ProviderValidationOptions
): ProviderValidationResult {
  const { llm, service_type, logger } = options;

  // ==========================================================================
  // Step 1: Get provider from registry
  // ==========================================================================
  const provider = get_provider(llm, logger);

  if (!provider) {
    const error_response = build_provider_not_found_error(llm);
    return { success: false, error_response };
  }

  // ==========================================================================
  // Step 2: Validate capability
  // ==========================================================================
  if (!validate_capability(provider, service_type, logger)) {
    const error_response: LLMResponse = {
      success: false,
      error: `LLM provider "${provider.get_name()}" does not support ${service_type} service`,
    };
    return { success: false, error_response };
  }

  return { success: true, provider };
}

// =============================================================================
// Error Message Builders
// =============================================================================

/**
 * Build a helpful error message when provider is not found
 *
 * @param llm - The requested LLM name (or undefined for primary)
 * @returns LLMResponse with helpful error message
 */
export function build_provider_not_found_error(llm?: string): LLMResponse {
  const provider_name = (llm || '').toLowerCase();
  const env_var_name = provider_name ? `${provider_name.toUpperCase()}_API_KEY` : '';

  const error = llm
    ? `LLM provider "${llm}" is enabled in config but not available. ${env_var_name ? `Check ${env_var_name} in environment variables.` : 'Provider may not be properly configured.'}`
    : 'No LLM provider configured. Check enabled_llms and primary_llm in hazo_llm_api_config.ini';

  return { success: false, error };
}

// =============================================================================
// Logging Helpers
// =============================================================================

/**
 * Log API call start with consistent formatting
 *
 * @param api_name - Name of the API being called
 * @param file_name - Source file name
 * @param logger - Logger instance
 */
export function log_api_start(
  api_name: string,
  file_name: string,
  logger: Logger
): void {
  logger.debug(`########################################################################### ${api_name}`, {
    file: file_name,
  });
}

/**
 * Log API call completion with consistent formatting
 *
 * @param api_name - Name of the API being called
 * @param file_name - Source file name
 * @param success - Whether the call was successful
 * @param logger - Logger instance
 */
export function log_api_complete(
  api_name: string,
  file_name: string,
  success: boolean,
  logger: Logger
): void {
  logger.debug(`<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< ${api_name} >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>`, {
    file: file_name,
    data: { success },
  });
}

/**
 * Log API call details including provider and model
 *
 * @param provider - The LLM provider
 * @param service_type - The service type being called
 * @param file_name - Source file name
 * @param logger - Logger instance
 * @param additional_data - Additional data to include in log
 */
export function log_api_details(
  provider: LLMProvider,
  service_type: ServiceType,
  file_name: string,
  logger: Logger,
  additional_data?: Record<string, unknown>
): void {
  const model = provider.get_model_for_service(service_type);

  logger.debug('API call details', {
    file: file_name,
    data: {
      provider: provider.get_name(),
      model: model || 'default',
      service_type,
      ...additional_data,
    },
  });
}

/**
 * Log API response
 *
 * @param response - The LLM response
 * @param file_name - Source file name
 * @param logger - Logger instance
 */
export function log_api_response(
  response: LLMResponse,
  file_name: string,
  logger: Logger
): void {
  logger.debug('API response', {
    file: file_name,
    data: {
      success: response.success,
      text: response.text,
      has_image: !!response.image_b64,
      error: response.error,
    },
  });
}

/**
 * Log and build error response for caught exceptions
 *
 * @param error - The caught error
 * @param function_name - Name of the function where error occurred
 * @param file_name - Source file name
 * @param logger - Logger instance
 * @returns LLMResponse with error details
 */
export function handle_caught_error(
  error: unknown,
  function_name: string,
  file_name: string,
  logger: Logger
): LLMResponse {
  const error_message = error instanceof Error ? error.message : String(error);

  logger.error(`Error in ${function_name}`, {
    file: file_name,
    data: { error: error_message },
  });

  return { success: false, error: error_message };
}

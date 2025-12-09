/**
 * Provider Helper Utilities
 *
 * Centralized helper functions for provider lookup, validation, and error handling.
 * Eliminates code duplication across service functions.
 */

import type { LLMProvider, ServiceType, ProviderName } from '../providers/types.js';
import type {
  Logger,
  LLMResponse,
  LLMErrorCode,
  LLMError,
  LLMRequestContext,
  LLMResponseContext,
  LLMErrorContext,
} from './types.js';
import { LLM_ERROR_CODES } from './types.js';
import { get_provider, validate_capability } from '../providers/registry.js';
import { get_hooks } from './index.js';

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
  llm?: ProviderName;
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
    const error_response = build_capability_error(provider.get_name(), service_type);
    return { success: false, error_response };
  }

  return { success: true, provider };
}

// =============================================================================
// Error Response Builders
// =============================================================================

/**
 * Build a structured error response with both legacy and new error formats
 *
 * @param code - Error code from LLM_ERROR_CODES
 * @param message - Human-readable error message
 * @param retryable - Whether this error is potentially retryable (default: false)
 * @param details - Additional error details (optional)
 * @returns LLMResponse with structured error
 *
 * @example
 * ```typescript
 * return build_error_response(
 *   LLM_ERROR_CODES.RATE_LIMITED,
 *   'Rate limit exceeded. Please try again later.',
 *   true,
 *   { retry_after: 60 }
 * );
 * ```
 */
export function build_error_response(
  code: LLMErrorCode,
  message: string,
  retryable: boolean = false,
  details?: Record<string, unknown>
): LLMResponse {
  const error_info: LLMError = {
    code,
    message,
    retryable,
    ...(details && { details }),
  };

  return {
    success: false,
    error: message, // Backward compatibility
    error_info,
  };
}

/**
 * Build a helpful error message when provider is not found
 *
 * @param llm - The requested LLM name (or undefined for primary)
 * @returns LLMResponse with helpful error message
 */
export function build_provider_not_found_error(llm?: ProviderName): LLMResponse {
  const provider_name = (llm || '').toLowerCase();
  const env_var_name = provider_name ? `${provider_name.toUpperCase()}_API_KEY` : '';

  const message = llm
    ? `LLM provider "${llm}" is enabled in config but not available. ${env_var_name ? `Check ${env_var_name} in environment variables.` : 'Provider may not be properly configured.'}`
    : 'No LLM provider configured. Check enabled_llms and primary_llm in hazo_llm_api_config.ini';

  return build_error_response(
    LLM_ERROR_CODES.PROVIDER_NOT_FOUND,
    message,
    false,
    { provider: llm, env_var_name: env_var_name || undefined }
  );
}

/**
 * Build an error response for unsupported capability
 *
 * @param provider_name - Name of the provider
 * @param service_type - The unsupported service type
 * @returns LLMResponse with capability error
 */
export function build_capability_error(
  provider_name: string,
  service_type: ServiceType
): LLMResponse {
  return build_error_response(
    LLM_ERROR_CODES.CAPABILITY_NOT_SUPPORTED,
    `LLM provider "${provider_name}" does not support ${service_type} service`,
    false,
    { provider: provider_name, service_type }
  );
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
 * @param error_code - Optional specific error code (defaults to UNKNOWN)
 * @returns LLMResponse with error details
 */
export function handle_caught_error(
  error: unknown,
  function_name: string,
  file_name: string,
  logger: Logger,
  error_code: LLMErrorCode = LLM_ERROR_CODES.UNKNOWN
): LLMResponse {
  const error_message = error instanceof Error ? error.message : String(error);

  // Determine if error is retryable based on common patterns
  const retryable = is_retryable_error(error);

  // Auto-detect error code if not specified
  const detected_code = error_code === LLM_ERROR_CODES.UNKNOWN
    ? detect_error_code(error)
    : error_code;

  logger.error(`Error in ${function_name}`, {
    file: file_name,
    data: { error: error_message, code: detected_code },
  });

  return build_error_response(
    detected_code,
    error_message,
    retryable,
    { function_name, file_name }
  );
}

/**
 * Determine if an error is potentially retryable
 *
 * @param error - The error to check
 * @returns True if the error is retryable
 */
function is_retryable_error(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  // Network/timeout errors are retryable
  if (
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('socket') ||
    message.includes('fetch failed')
  ) {
    return true;
  }

  // Rate limit errors are retryable
  if (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('429')
  ) {
    return true;
  }

  return false;
}

/**
 * Auto-detect error code from error message
 *
 * @param error - The error to analyze
 * @returns Detected error code
 */
function detect_error_code(error: unknown): LLMErrorCode {
  if (!(error instanceof Error)) {
    return LLM_ERROR_CODES.UNKNOWN;
  }

  const message = error.message.toLowerCase();

  // Network errors
  if (
    message.includes('network') ||
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('socket') ||
    message.includes('fetch failed')
  ) {
    return LLM_ERROR_CODES.NETWORK_ERROR;
  }

  // Timeout errors
  if (message.includes('timeout')) {
    return LLM_ERROR_CODES.TIMEOUT;
  }

  // Rate limit errors
  if (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('429')
  ) {
    return LLM_ERROR_CODES.RATE_LIMITED;
  }

  // API key errors
  if (
    message.includes('api key') ||
    message.includes('unauthorized') ||
    message.includes('401') ||
    message.includes('authentication')
  ) {
    return LLM_ERROR_CODES.API_KEY_MISSING;
  }

  // Invalid request errors
  if (
    message.includes('invalid') ||
    message.includes('bad request') ||
    message.includes('400')
  ) {
    return LLM_ERROR_CODES.INVALID_REQUEST;
  }

  return LLM_ERROR_CODES.UNKNOWN;
}

// =============================================================================
// Hook Invocation Helpers
// =============================================================================

/**
 * Call the beforeRequest hook if configured
 *
 * @param context - Request context
 */
export async function call_before_request_hook(
  context: LLMRequestContext
): Promise<void> {
  const hooks = get_hooks();
  if (hooks.beforeRequest) {
    try {
      await hooks.beforeRequest(context);
    } catch {
      // Silently ignore hook errors to not affect main flow
    }
  }
}

/**
 * Call the afterResponse hook if configured
 *
 * @param context - Response context
 */
export async function call_after_response_hook(
  context: LLMResponseContext
): Promise<void> {
  const hooks = get_hooks();
  if (hooks.afterResponse) {
    try {
      await hooks.afterResponse(context);
    } catch {
      // Silently ignore hook errors to not affect main flow
    }
  }
}

/**
 * Call the onError hook if configured
 *
 * @param context - Error context
 */
export async function call_on_error_hook(
  context: LLMErrorContext
): Promise<void> {
  const hooks = get_hooks();
  if (hooks.onError) {
    try {
      await hooks.onError(context);
    } catch {
      // Silently ignore hook errors to not affect main flow
    }
  }
}

/**
 * Create a request context for hooks
 *
 * @param service_type - Service type being called
 * @param provider - Provider name
 * @param params - Request parameters
 * @returns Request context
 */
export function create_request_context(
  service_type: ServiceType,
  provider: string,
  params: Record<string, unknown>
): LLMRequestContext {
  return {
    service_type,
    provider,
    params,
    timestamp: new Date(),
  };
}

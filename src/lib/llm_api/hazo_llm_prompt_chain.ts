/**
 * hazo_llm_prompt_chain Function
 *
 * Executes a sequence of LLM calls where each call can reference
 * values from previous call results. Supports all 4 service types:
 * text_text, image_text, text_image, image_image.
 */

import type { Database as SqlJsDatabase } from 'sql.js';
import type {
  PromptChainParams,
  PromptChainResponse,
  ChainCallResult,
  ChainCallDefinition,
  LLMApiConfig,
  LLMResponse,
  TextTextParams,
  ImageTextParams,
  TextImageParams,
  ImageImageParams,
  Base64Data,
  PromptVariables,
  Logger,
} from './types.js';
import type { ServiceType } from '../providers/types.js';
import { hazo_llm_text_text } from './hazo_llm_text_text.js';
import { hazo_llm_image_text } from './hazo_llm_image_text.js';
import { hazo_llm_text_image } from './hazo_llm_text_image.js';
import { hazo_llm_image_image } from './hazo_llm_image_image.js';
import {
  resolve_chain_field,
  build_prompt_variables,
  merge_chain_results,
  parse_llm_json_response,
  resolve_chain_image_definition,
} from './chain_helpers.js';

// =============================================================================
// Constants
// =============================================================================

const FILE_NAME = 'hazo_llm_prompt_chain.ts';
const API_NAME = 'prompt_chain';

// Default call type for backward compatibility
const DEFAULT_CALL_TYPE: ServiceType = 'text_text';

// =============================================================================
// Service Parameter Types
// =============================================================================

type ServiceParams = TextTextParams | ImageTextParams | TextImageParams | ImageImageParams;

interface BuildParamsResult {
  success: boolean;
  params?: ServiceParams;
  error?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build service-specific parameters based on call type
 *
 * @param call_def - The chain call definition
 * @param call_type - The service type to build params for
 * @param prompt_variables - Resolved prompt variables
 * @param previous_results - Array of previous call results
 * @param logger - Logger instance
 * @returns Build result with params or error
 */
function build_service_params(
  call_def: ChainCallDefinition,
  call_type: ServiceType,
  prompt_variables: PromptVariables,
  previous_results: ChainCallResult[],
  logger: Logger
): BuildParamsResult {
  // Base params common to all types
  const base_params = {
    prompt: '', // Will be overridden by dynamic prompt
    prompt_variables,
  };

  switch (call_type) {
    case 'text_text':
      return { success: true, params: base_params as TextTextParams };

    case 'text_image':
      return { success: true, params: base_params as TextImageParams };

    case 'image_text': {
      // Resolve image_b64 and image_mime_type
      if (!call_def.image_b64 || !call_def.image_mime_type) {
        return {
          success: false,
          error: 'image_text requires image_b64 and image_mime_type fields',
        };
      }

      const image_b64 = resolve_chain_field(call_def.image_b64, previous_results, logger);
      const image_mime_type = resolve_chain_field(call_def.image_mime_type, previous_results, logger);

      if (!image_b64) {
        return {
          success: false,
          error: 'Could not resolve image_b64 for image_text call',
        };
      }

      if (!image_mime_type) {
        return {
          success: false,
          error: 'Could not resolve image_mime_type for image_text call',
        };
      }

      logger.debug('Resolved image for image_text', {
        file: FILE_NAME,
        data: {
          image_b64_length: image_b64.length,
          image_mime_type,
        },
      });

      return {
        success: true,
        params: {
          ...base_params,
          image_b64,
          image_mime_type,
        } as ImageTextParams,
      };
    }

    case 'image_image': {
      const images: Base64Data[] = [];

      // Multi-image mode - prefer images array if provided
      if (call_def.images && call_def.images.length > 0) {
        for (const img_def of call_def.images) {
          const resolved = resolve_chain_image_definition(img_def, previous_results, logger);
          if (resolved) {
            images.push({
              data: resolved.image_b64,
              mime_type: resolved.image_mime_type,
            });
          } else {
            logger.warn('Failed to resolve image in images array', {
              file: FILE_NAME,
            });
          }
        }
      }
      // Single image mode
      else if (call_def.image_b64 && call_def.image_mime_type) {
        const image_b64 = resolve_chain_field(call_def.image_b64, previous_results, logger);
        const image_mime_type = resolve_chain_field(call_def.image_mime_type, previous_results, logger);

        if (image_b64 && image_mime_type) {
          images.push({
            data: image_b64,
            mime_type: image_mime_type,
          });
        }
      }

      if (images.length === 0) {
        return {
          success: false,
          error: 'image_image requires at least one image (via image_b64/image_mime_type or images array)',
        };
      }

      logger.debug('Resolved images for image_image', {
        file: FILE_NAME,
        data: { image_count: images.length },
      });

      return {
        success: true,
        params: {
          ...base_params,
          images,
        } as ImageImageParams,
      };
    }

    default:
      return {
        success: false,
        error: `Unknown call_type: ${call_type}`,
      };
  }
}

/**
 * Dispatch to the appropriate service function based on call type
 *
 * @param call_type - The service type to invoke
 * @param params - Service-specific parameters
 * @param prompt_area - Prompt area for dynamic prompt lookup
 * @param prompt_key - Prompt key for dynamic prompt lookup
 * @param db - Database instance
 * @param config - LLM API configuration
 * @param llm - Optional LLM provider name
 * @returns LLM response
 */
async function dispatch_service_call(
  call_type: ServiceType,
  params: ServiceParams,
  prompt_area: string,
  prompt_key: string,
  db: SqlJsDatabase | null,
  config: LLMApiConfig,
  llm: string | undefined
): Promise<LLMResponse> {
  // Add prompt_area and prompt_key for dynamic prompt lookup
  const params_with_prompt = {
    ...params,
    prompt_area,
    prompt_key,
  };

  switch (call_type) {
    case 'text_text':
      return await hazo_llm_text_text(params_with_prompt as TextTextParams, db, config, llm);

    case 'image_text':
      return await hazo_llm_image_text(params_with_prompt as ImageTextParams, db, config, llm);

    case 'text_image':
      return await hazo_llm_text_image(params_with_prompt as TextImageParams, db, config, llm);

    case 'image_image':
      return await hazo_llm_image_image(params_with_prompt as ImageImageParams, db, config, llm);

    default:
      throw new Error(`Unsupported call_type: ${call_type}`);
  }
}

/**
 * Check if a call type produces text output
 */
function is_text_output_type(call_type: ServiceType): boolean {
  return call_type === 'text_text' || call_type === 'image_text';
}

/**
 * Check if a call type produces image output
 */
function is_image_output_type(call_type: ServiceType): boolean {
  return call_type === 'text_image' || call_type === 'image_image';
}

// =============================================================================
// hazo_llm_prompt_chain Function
// =============================================================================

/**
 * Execute a chain of prompt calls with dynamic value resolution
 *
 * @param params - Chain parameters including call definitions
 * @param db - Database instance for prompt retrieval
 * @param config - LLM API configuration
 * @param llm - Optional LLM provider name
 * @returns Chain response with merged results and individual call outcomes
 */
export async function hazo_llm_prompt_chain(
  params: PromptChainParams,
  db: SqlJsDatabase | null,
  config: LLMApiConfig,
  llm?: string
): Promise<PromptChainResponse> {
  // Use default logger if not provided
  const { default_logger } = await import('./index.js');
  const logger = config.logger || default_logger;

  const continue_on_error = params.continue_on_error ?? true;
  const call_results: ChainCallResult[] = [];
  const errors: Array<{ call_index: number; error: string }> = [];

  logger.debug(
    `########################################################################### ${API_NAME}`,
    {
      file: FILE_NAME,
    }
  );

  logger.info('Starting prompt chain execution', {
    file: FILE_NAME,
    data: {
      total_calls: params.chain_calls.length,
      continue_on_error,
    },
  });

  // Execute each call in sequence
  for (let i = 0; i < params.chain_calls.length; i++) {
    const call_def = params.chain_calls[i];

    logger.debug(`Chain Step ${i + 1}/${params.chain_calls.length}`, {
      file: FILE_NAME,
    });

    // Resolve prompt_area and prompt_key
    const prompt_area = resolve_chain_field(
      call_def.prompt_area,
      call_results,
      logger
    );
    const prompt_key = resolve_chain_field(
      call_def.prompt_key,
      call_results,
      logger
    );

    if (!prompt_area || !prompt_key) {
      const error_msg = `Could not resolve prompt_area or prompt_key for call ${i}`;
      logger.error(error_msg, {
        file: FILE_NAME,
        data: { call_index: i, prompt_area, prompt_key },
      });

      errors.push({ call_index: i, error: error_msg });
      call_results.push({
        call_index: i,
        success: false,
        error: error_msg,
        prompt_area: prompt_area || 'unresolved',
        prompt_key: prompt_key || 'unresolved',
      });

      if (!continue_on_error) {
        break;
      }
      continue;
    }

    // Get call type (default to text_text for backward compatibility)
    const call_type = call_def.call_type || DEFAULT_CALL_TYPE;

    // Build prompt variables from variables array
    const prompt_variables = build_prompt_variables(
      call_def.variables,
      call_results,
      logger
    );

    // Build service-specific parameters
    const param_result = build_service_params(
      call_def,
      call_type,
      prompt_variables,
      call_results,
      logger
    );

    if (!param_result.success) {
      const error_msg = param_result.error || 'Failed to build parameters';
      logger.error(error_msg, {
        file: FILE_NAME,
        data: { call_index: i, call_type },
      });

      errors.push({ call_index: i, error: error_msg });
      call_results.push({
        call_index: i,
        success: false,
        error: error_msg,
        prompt_area,
        prompt_key,
      });

      if (!continue_on_error) {
        break;
      }
      continue;
    }

    logger.info(`Executing ${call_type} call`, {
      file: FILE_NAME,
      data: {
        call_index: i,
        call_type,
        prompt_area,
        prompt_key,
        variables_defined: call_def.variables?.length || 0,
        variables_resolved: prompt_variables.length > 0 ? prompt_variables[0] : {},
      },
    });

    // Execute the LLM call
    try {
      const response = await dispatch_service_call(
        call_type,
        param_result.params!,
        prompt_area,
        prompt_key,
        db,
        config,
        llm
      );

      if (!response.success) {
        const error_msg = response.error || 'Unknown error';
        logger.error(`Call ${i} failed`, {
          file: FILE_NAME,
          data: { call_index: i, call_type, error: error_msg },
        });

        errors.push({ call_index: i, error: error_msg });
        call_results.push({
          call_index: i,
          success: false,
          error: error_msg,
          prompt_area,
          prompt_key,
        });

        if (!continue_on_error) {
          break;
        }
        continue;
      }

      // Build result based on call type
      const result: ChainCallResult = {
        call_index: i,
        success: true,
        prompt_area,
        prompt_key,
      };

      // Text output types (text_text, image_text)
      if (is_text_output_type(call_type)) {
        result.raw_text = response.text || '';
        result.parsed_result = parse_llm_json_response(result.raw_text, logger) || undefined;
      }

      // Image output types (text_image, image_image)
      if (is_image_output_type(call_type)) {
        result.image_b64 = response.image_b64;
        result.image_mime_type = response.image_mime_type;
      }

      call_results.push(result);

      logger.info(`Call ${i} completed successfully`, {
        file: FILE_NAME,
        data: {
          call_index: i,
          call_type,
          has_text: !!result.raw_text,
          has_parsed_result: !!result.parsed_result,
          has_image: !!result.image_b64,
        },
      });
    } catch (error) {
      const error_msg = error instanceof Error ? error.message : String(error);
      logger.error(`Call ${i} threw exception`, {
        file: FILE_NAME,
        data: { call_index: i, call_type, error: error_msg },
      });

      errors.push({ call_index: i, error: error_msg });
      call_results.push({
        call_index: i,
        success: false,
        error: error_msg,
        prompt_area,
        prompt_key,
      });

      if (!continue_on_error) {
        break;
      }
    }
  }

  // Merge all successful results
  const merged_result = merge_chain_results(call_results, logger);
  const successful_calls = call_results.filter((r) => r.success).length;

  logger.info('Prompt chain execution complete', {
    file: FILE_NAME,
    data: {
      total_calls: params.chain_calls.length,
      successful_calls,
      error_count: errors.length,
    },
  });

  logger.debug(
    `<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< ${API_NAME} >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>`,
    {
      file: FILE_NAME,
      data: { success: successful_calls > 0 },
    }
  );

  return {
    success: successful_calls > 0,
    merged_result,
    call_results,
    errors,
    total_calls: params.chain_calls.length,
    successful_calls,
  };
}

/**
 * hazo_llm_dynamic_data_extract Function
 *
 * Executes a chain of LLM calls where the next prompt is determined by
 * JSON output from the current call using the next_prompt database field
 * with JSONPath extraction and conditional branching.
 */

import type { Database as SqlJsDatabase } from 'sql.js';
import type {
  DynamicDataExtractParams,
  DynamicDataExtractResponse,
  DynamicExtractStepResult,
  DynamicExtractStopReason,
  NextPromptConfig,
  LLMApiConfig,
  TextTextParams,
  ImageTextParams,
  PromptVariables,
  Logger,
} from './types.js';
import { hazo_llm_text_text } from './hazo_llm_text_text.js';
import { hazo_llm_image_text } from './hazo_llm_image_text.js';
import { get_prompt_by_area_and_key } from '../prompts/get_prompt.js';
import { parse_llm_json_response, deep_merge } from './chain_helpers.js';
import {
  parse_next_prompt_config,
  resolve_next_prompt,
} from './dynamic_extract_helpers.js';

// =============================================================================
// Constants
// =============================================================================

const FILE_NAME = 'hazo_llm_dynamic_data_extract.ts';
const API_NAME = 'dynamic_data_extract';
const DEFAULT_MAX_DEPTH = 10;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build prompt variables from merged result and context data
 * Flattens nested objects into a single-level map for variable substitution
 *
 * @param merged_result - Accumulated results from previous steps
 * @param context_data - Additional context data provided by user
 * @returns Prompt variables array for substitution
 */
function build_step_variables(
  merged_result: Record<string, unknown>,
  context_data: Record<string, unknown> | undefined
): PromptVariables {
  const variables: Record<string, string> = {};

  // Helper to flatten nested objects
  function flatten(obj: Record<string, unknown>, prefix: string = ''): void {
    for (const [key, value] of Object.entries(obj)) {
      const full_key = prefix ? `${prefix}.${key}` : key;

      if (value === null || value === undefined) {
        continue;
      }

      if (typeof value === 'object' && !Array.isArray(value)) {
        flatten(value as Record<string, unknown>, full_key);
      } else if (typeof value === 'string') {
        variables[full_key] = value;
      } else {
        variables[full_key] = String(value);
      }
    }
  }

  // First add context data (lower priority)
  if (context_data) {
    flatten(context_data);
  }

  // Then add merged result (higher priority, overwrites context)
  flatten(merged_result);

  return Object.keys(variables).length > 0 ? [variables] : [];
}

// =============================================================================
// hazo_llm_dynamic_data_extract Function
// =============================================================================

/**
 * Execute a dynamic chain of LLM calls guided by next_prompt configuration
 *
 * The chain starts with the initial prompt and continues until:
 * - A prompt has no next_prompt configured (normal termination)
 * - max_depth is reached (safety limit)
 * - An error occurs (if continue_on_error is false)
 * - The resolved next prompt doesn't exist in the database
 *
 * Each step's JSON output is deep-merged with accumulated results,
 * which are then available for variable substitution in subsequent prompts.
 *
 * @param params - Dynamic extract parameters
 * @param db - Database instance for prompt retrieval
 * @param config - LLM API configuration
 * @param llm - Optional LLM provider name
 * @returns Dynamic extract response with merged results and step details
 *
 * @example
 * ```typescript
 * // Setup prompts:
 * // - "doc/classify" returns { document_type: "invoice" }
 * //   with next_prompt: { static_prompt_area: "doc", dynamic_prompt_key: "$.document_type" }
 * // - "doc/invoice" returns { amount: 1500, vendor: "ACME" }
 * //   with no next_prompt (terminates chain)
 *
 * const result = await hazo_llm_dynamic_data_extract({
 *   initial_prompt_area: 'doc',
 *   initial_prompt_key: 'classify',
 *   image_b64: '...',
 *   image_mime_type: 'image/png'
 * }, db, config);
 *
 * // result.merged_result = { document_type: 'invoice', amount: 1500, vendor: 'ACME' }
 * // result.step_results = [{ step_index: 0, ... }, { step_index: 1, ... }]
 * // result.final_stop_reason = 'no_next_prompt'
 * ```
 */
export async function hazo_llm_dynamic_data_extract(
  params: DynamicDataExtractParams,
  db: SqlJsDatabase | null,
  config: LLMApiConfig,
  llm?: string
): Promise<DynamicDataExtractResponse> {
  // Use default logger if not provided
  const { default_logger } = await import('./index.js');
  const logger = config.logger || default_logger;

  const max_depth = params.max_depth ?? DEFAULT_MAX_DEPTH;
  const continue_on_error = params.continue_on_error ?? false;

  const step_results: DynamicExtractStepResult[] = [];
  const errors: Array<{ step_index: number; error: string }> = [];
  let merged_result: Record<string, unknown> = {};
  let final_stop_reason: DynamicExtractStopReason = 'no_next_prompt';

  logger.debug(
    `########################################################################### ${API_NAME}`,
    { file: FILE_NAME }
  );

  const doc_b64_length = params.image_b64?.length || 0;
  logger.info('Starting dynamic data extract', {
    file: FILE_NAME,
    data: {
      initial_prompt_area: params.initial_prompt_area,
      initial_prompt_key: params.initial_prompt_key,
      max_depth,
      continue_on_error,
      has_document: !!params.image_b64,
      document_mime_type: params.image_mime_type || null,
      document_b64: params.image_b64 ? `[BASE64_DATA: ${doc_b64_length} chars]` : null,
    },
  });

  // Database is required for prompt retrieval
  if (!db) {
    const error_msg = 'Database is required for dynamic data extract';
    logger.error(error_msg, { file: FILE_NAME });

    return {
      success: false,
      merged_result: {},
      step_results: [],
      errors: [{ step_index: 0, error: error_msg }],
      total_steps: 0,
      successful_steps: 0,
      final_stop_reason: 'error',
    };
  }

  // Current position in the chain
  let current_area = params.initial_prompt_area;
  let current_key = params.initial_prompt_key;
  let is_first_step = true;

  // Chain execution loop
  for (let step_index = 0; step_index < max_depth; step_index++) {
    logger.debug(`Dynamic Extract Step ${step_index + 1}/${max_depth}`, {
      file: FILE_NAME,
      data: { prompt_area: current_area, prompt_key: current_key },
    });

    // Retrieve prompt from database
    const prompt_record = get_prompt_by_area_and_key(
      db,
      current_area,
      current_key,
      logger
    );

    if (!prompt_record) {
      const error_msg = `Prompt not found: ${current_area}/${current_key}`;
      logger.error(error_msg, {
        file: FILE_NAME,
        data: { step_index, prompt_area: current_area, prompt_key: current_key },
      });

      errors.push({ step_index, error: error_msg });
      step_results.push({
        step_index,
        success: false,
        prompt_area: current_area,
        prompt_key: current_key,
        error: error_msg,
      });

      final_stop_reason = 'next_prompt_not_found';

      if (!continue_on_error) {
        break;
      }
      continue;
    }

    // Build variables from accumulated results and context
    const prompt_variables: PromptVariables = is_first_step
      ? params.initial_prompt_variables || []
      : build_step_variables(merged_result, params.context_data);

    // Execute LLM call
    let llm_response;

    try {
      if (params.image_b64 && params.image_mime_type) {
        // Document provided - use image_text for all steps
        // ImageTextParams doesn't support prompt_area/prompt_key, so we use the already-retrieved prompt_record

        const image_params: ImageTextParams = {
          prompt: prompt_record.prompt_text,
          prompt_variables,
          image_b64: params.image_b64,
          image_mime_type: params.image_mime_type,
        };

        const doc_b64_length = params.image_b64?.length || 0;
        const image_params_b64_length = image_params.image_b64?.length || 0;
        logger.info(`[DYNAMIC_EXTRACT] Step ${step_index}: Calling image_text with document`, {
          file: FILE_NAME,
          data: {
            step_index,
            prompt_area: current_area,
            prompt_key: current_key,
            has_variables: prompt_variables.length > 0,
            is_first_step,
            params_image_b64_length: doc_b64_length,
            image_params_b64_length: image_params_b64_length,
            document_mime_type: params.image_mime_type,
            image_params_mime_type: image_params.image_mime_type,
          },
        });

        llm_response = await hazo_llm_image_text(image_params, db, config, llm);
      } else {
        // Text-only call (no document provided)
        const text_params: TextTextParams = {
          prompt: '', // Will be overridden by dynamic prompt
          prompt_area: current_area,
          prompt_key: current_key,
          prompt_variables,
        };

        logger.debug('Executing text_text call', {
          file: FILE_NAME,
          data: { step_index, has_variables: prompt_variables.length > 0 },
        });

        llm_response = await hazo_llm_text_text(text_params, db, config, llm);
      }
    } catch (error) {
      const error_msg = error instanceof Error ? error.message : String(error);
      logger.error('LLM call threw exception', {
        file: FILE_NAME,
        data: { step_index, error: error_msg },
      });

      errors.push({ step_index, error: error_msg });
      step_results.push({
        step_index,
        success: false,
        prompt_area: current_area,
        prompt_key: current_key,
        error: error_msg,
      });

      final_stop_reason = 'error';

      if (!continue_on_error) {
        break;
      }
      continue;
    }

    // Handle LLM response failure
    if (!llm_response.success) {
      const error_msg = llm_response.error || 'LLM call failed';
      logger.error('LLM call failed', {
        file: FILE_NAME,
        data: { step_index, error: error_msg },
      });

      errors.push({ step_index, error: error_msg });
      step_results.push({
        step_index,
        success: false,
        prompt_area: current_area,
        prompt_key: current_key,
        error: error_msg,
      });

      final_stop_reason = 'error';

      if (!continue_on_error) {
        break;
      }
      continue;
    }

    // Parse JSON response
    const raw_text = llm_response.text || '';
    const parsed_result = parse_llm_json_response(raw_text, logger);

    // Merge result into accumulated results
    if (parsed_result) {
      merged_result = deep_merge(merged_result, parsed_result);
    }

    // Parse next_prompt configuration
    const next_prompt_config = parse_next_prompt_config(
      prompt_record.next_prompt,
      logger
    );

    // Build step result
    const step_result: DynamicExtractStepResult = {
      step_index,
      success: true,
      prompt_area: current_area,
      prompt_key: current_key,
      raw_text,
      parsed_result: parsed_result || undefined,
      next_prompt_resolution: {
        config: next_prompt_config,
      },
    };

    // Resolve next prompt if configured
    if (next_prompt_config && parsed_result) {
      const resolved = resolve_next_prompt(
        next_prompt_config,
        parsed_result,
        logger
      );

      if (resolved) {
        step_result.next_prompt_resolution = {
          config: next_prompt_config,
          resolved_area: resolved.prompt_area,
          resolved_key: resolved.prompt_key,
          matched_branch:
            resolved.resolution_type === 'branch'
              ? 'branch'
              : resolved.resolution_type === 'default'
                ? 'default'
                : 'simple',
          branch_index: resolved.branch_index,
        };

        logger.info('Resolved next prompt', {
          file: FILE_NAME,
          data: {
            step_index,
            next_area: resolved.prompt_area,
            next_key: resolved.prompt_key,
            resolution_type: resolved.resolution_type,
          },
        });

        // Update for next iteration
        current_area = resolved.prompt_area;
        current_key = resolved.prompt_key;
        is_first_step = false;

        step_results.push(step_result);
        continue; // Continue to next step
      } else {
        logger.debug('next_prompt configured but could not be resolved', {
          file: FILE_NAME,
          data: { step_index, config: next_prompt_config },
        });
      }
    }

    // No next_prompt or couldn't resolve - end of chain
    step_results.push(step_result);
    final_stop_reason = 'no_next_prompt';

    logger.info('Chain terminated normally', {
      file: FILE_NAME,
      data: {
        step_index,
        reason: next_prompt_config
          ? 'could not resolve next_prompt'
          : 'no next_prompt configured',
      },
    });

    break;
  }

  // Check if we hit max_depth
  if (step_results.length >= max_depth) {
    const last_step = step_results[step_results.length - 1];
    if (last_step && last_step.success && last_step.next_prompt_resolution?.resolved_area) {
      final_stop_reason = 'max_depth';
      logger.warn('Chain terminated due to max_depth', {
        file: FILE_NAME,
        data: { max_depth, step_count: step_results.length },
      });
    }
  }

  const successful_steps = step_results.filter((r) => r.success).length;

  logger.info('Dynamic data extract complete', {
    file: FILE_NAME,
    data: {
      total_steps: step_results.length,
      successful_steps,
      error_count: errors.length,
      final_stop_reason,
    },
  });

  logger.debug(
    `<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< ${API_NAME} >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>`,
    {
      file: FILE_NAME,
      data: { success: successful_steps > 0 },
    }
  );

  return {
    success: successful_steps > 0,
    merged_result,
    step_results,
    errors,
    total_steps: step_results.length,
    successful_steps,
    final_stop_reason,
  };
}

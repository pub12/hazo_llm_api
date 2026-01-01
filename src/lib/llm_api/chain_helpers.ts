/**
 * Chain Helper Functions
 *
 * Utility functions for parsing call_chain paths, resolving values,
 * and deep merging results in prompt chains.
 */

import type {
  Logger,
  ChainFieldDefinition,
  ChainVariableDefinition,
  ChainImageDefinition,
  ChainCallResult,
  PromptVariables,
} from './types.js';

const FILE_NAME = 'chain_helpers.ts';

// =============================================================================
// Path Parsing Types
// =============================================================================

interface ParsedPath {
  call_index: number;
  property_path: string[];
}

// =============================================================================
// Path Parsing Functions
// =============================================================================

/**
 * Parse a call_chain path expression like "call[0].tax_category" or "call[2].data.nested.value"
 *
 * @param path_expr - The path expression to parse
 * @param logger - Logger instance
 * @returns Parsed path with call index and property path array, or null if invalid
 */
export function parse_call_chain_path(
  path_expr: string,
  logger: Logger
): ParsedPath | null {
  // Pattern: call[N].property.path
  const match = path_expr.match(/^call\[(\d+)\]\.(.+)$/);

  if (!match) {
    logger.error('Invalid call_chain path format', {
      file: FILE_NAME,
      data: { path_expr, expected_format: 'call[N].property.path' },
    });
    return null;
  }

  const call_index = parseInt(match[1], 10);
  const property_path = match[2].split('.');

  logger.debug('Parsed call_chain path', {
    file: FILE_NAME,
    data: { path_expr, call_index, property_path },
  });

  return { call_index, property_path };
}

/**
 * Extract a value from a nested object using a property path array
 *
 * @param obj - The object to extract from
 * @param path - Array of property names to traverse
 * @param logger - Logger instance
 * @returns The extracted value as a string, or null if not found
 */
export function extract_value_from_path(
  obj: Record<string, unknown>,
  path: string[],
  logger: Logger
): string | null {
  let current: unknown = obj;

  for (const key of path) {
    if (current === null || current === undefined) {
      logger.warn('Path traversal encountered null/undefined', {
        file: FILE_NAME,
        data: { path, failed_at: key },
      });
      return null;
    }

    if (typeof current !== 'object') {
      logger.warn('Path traversal encountered non-object', {
        file: FILE_NAME,
        data: { path, failed_at: key, type: typeof current },
      });
      return null;
    }

    current = (current as Record<string, unknown>)[key];
  }

  // Convert result to string
  if (current === null || current === undefined) {
    return null;
  }

  if (typeof current === 'string') {
    return current;
  }

  if (typeof current === 'number' || typeof current === 'boolean') {
    return String(current);
  }

  // For objects/arrays, return JSON string
  return JSON.stringify(current);
}

/**
 * Extract a value from a ChainCallResult using a property path
 * Supports both parsed_result fields and top-level image/text fields
 *
 * Examples:
 * - "image_b64" -> returns result.image_b64
 * - "image_mime_type" -> returns result.image_mime_type
 * - "raw_text" -> returns result.raw_text
 * - "country" -> traverses result.parsed_result.country
 * - "data.nested.value" -> traverses result.parsed_result.data.nested.value
 *
 * @param result - The ChainCallResult to extract from
 * @param property_path - Array of property names to traverse
 * @param logger - Logger instance
 * @returns The extracted value as a string, or null if not found
 */
export function extract_value_from_result(
  result: ChainCallResult,
  property_path: string[],
  logger: Logger
): string | null {
  if (property_path.length === 0) {
    logger.warn('Empty property path provided', { file: FILE_NAME });
    return null;
  }

  const first_key = property_path[0];

  // Handle top-level image fields directly
  if (property_path.length === 1) {
    if (first_key === 'image_b64' && result.image_b64) {
      return result.image_b64;
    }
    if (first_key === 'image_mime_type' && result.image_mime_type) {
      return result.image_mime_type;
    }
    if (first_key === 'raw_text' && result.raw_text) {
      return result.raw_text;
    }
  }

  // For paths starting with top-level fields that don't exist, try parsed_result
  if (first_key === 'image_b64' || first_key === 'image_mime_type' || first_key === 'raw_text') {
    // These are top-level only, no nesting
    if (property_path.length === 1) {
      logger.warn('Top-level field not found in result', {
        file: FILE_NAME,
        data: { field: first_key, has_field: false },
      });
      return null;
    }
  }

  // Otherwise, extract from parsed_result
  if (!result.parsed_result) {
    logger.warn('No parsed_result available for path extraction', {
      file: FILE_NAME,
      data: { property_path },
    });
    return null;
  }

  return extract_value_from_path(result.parsed_result, property_path, logger);
}

// =============================================================================
// Value Resolution Functions
// =============================================================================

/**
 * Resolve a chain field definition to its actual value
 * Supports both parsed_result fields and top-level image/text fields
 *
 * @param field - The field definition to resolve
 * @param previous_results - Array of previous call results
 * @param logger - Logger instance
 * @returns Resolved string value, or null if resolution failed
 */
export function resolve_chain_field(
  field: ChainFieldDefinition,
  previous_results: ChainCallResult[],
  logger: Logger
): string | null {
  if (field.match_type === 'direct') {
    return field.value;
  }

  // match_type === 'call_chain'
  const parsed = parse_call_chain_path(field.value, logger);

  if (!parsed) {
    return null;
  }

  // Check if referenced call exists
  if (parsed.call_index >= previous_results.length) {
    logger.error('call_chain references future or non-existent call', {
      file: FILE_NAME,
      data: {
        call_index: parsed.call_index,
        available_calls: previous_results.length,
      },
    });
    return null;
  }

  const referenced_result = previous_results[parsed.call_index];

  // Check if referenced call was successful
  if (!referenced_result.success) {
    logger.warn('call_chain references failed call', {
      file: FILE_NAME,
      data: {
        call_index: parsed.call_index,
        success: referenced_result.success,
      },
    });
    return null;
  }

  // Extract value from result (supports both image fields and parsed_result)
  const value = extract_value_from_result(
    referenced_result,
    parsed.property_path,
    logger
  );

  if (value === null) {
    logger.warn('Could not extract value from call_chain path', {
      file: FILE_NAME,
      data: {
        path: field.value,
        call_index: parsed.call_index,
      },
    });
  }

  return value;
}

// =============================================================================
// Variable Building Functions
// =============================================================================

/**
 * Resolve a chain variable definition to its actual value
 * Supports both parsed_result fields and top-level image/text fields
 *
 * @param variable - The variable definition to resolve
 * @param previous_results - Array of previous call results
 * @param logger - Logger instance
 * @returns Resolved string value, or null if resolution failed
 */
export function resolve_chain_variable(
  variable: ChainVariableDefinition,
  previous_results: ChainCallResult[],
  logger: Logger
): string | null {
  if (variable.match_type === 'direct') {
    return variable.value;
  }

  // match_type === 'call_chain'
  const parsed = parse_call_chain_path(variable.value, logger);

  if (!parsed) {
    return null;
  }

  // Check if referenced call exists
  if (parsed.call_index >= previous_results.length) {
    logger.error('call_chain references future or non-existent call', {
      file: FILE_NAME,
      data: {
        call_index: parsed.call_index,
        available_calls: previous_results.length,
        variable_name: variable.variable_name,
      },
    });
    return null;
  }

  const referenced_result = previous_results[parsed.call_index];

  // Check if referenced call was successful
  if (!referenced_result.success) {
    logger.warn('call_chain references failed call', {
      file: FILE_NAME,
      data: {
        call_index: parsed.call_index,
        success: referenced_result.success,
        variable_name: variable.variable_name,
      },
    });
    return null;
  }

  // Extract value from result (supports both image fields and parsed_result)
  const value = extract_value_from_result(
    referenced_result,
    parsed.property_path,
    logger
  );

  if (value === null) {
    logger.warn('Could not extract value from call_chain path', {
      file: FILE_NAME,
      data: {
        path: variable.value,
        call_index: parsed.call_index,
        variable_name: variable.variable_name,
      },
    });
  }

  return value;
}

/**
 * Build prompt variables from a variables array in a chain call definition
 *
 * @param variables_array - Array of variable definitions
 * @param previous_results - Array of previous call results
 * @param logger - Logger instance
 * @returns PromptVariables array for substitution
 */
export function build_prompt_variables(
  variables_array: ChainVariableDefinition[] | undefined,
  previous_results: ChainCallResult[],
  logger: Logger
): PromptVariables {
  if (!variables_array || variables_array.length === 0) {
    return [];
  }

  const variables: Record<string, string> = {};

  variables_array.forEach((variable, index) => {
    if (!variable.variable_name) {
      logger.warn('Variable definition missing variable_name', {
        file: FILE_NAME,
        data: { index },
      });
      return;
    }

    const resolved_value = resolve_chain_variable(variable, previous_results, logger);

    if (resolved_value !== null) {
      variables[variable.variable_name] = resolved_value;
      logger.debug('Built variable from definition', {
        file: FILE_NAME,
        data: {
          index,
          variable_name: variable.variable_name,
          match_type: variable.match_type,
          value_preview: resolved_value.substring(0, 50),
        },
      });
    } else {
      logger.warn('Could not resolve variable value', {
        file: FILE_NAME,
        data: {
          index,
          variable_name: variable.variable_name,
          match_type: variable.match_type,
          value: variable.value,
        },
      });
    }
  });

  return Object.keys(variables).length > 0 ? [variables] : [];
}

// =============================================================================
// Image Resolution Functions
// =============================================================================

/**
 * Resolved image data from a ChainImageDefinition
 */
export interface ResolvedImage {
  image_b64: string;
  image_mime_type: string;
}

/**
 * Resolve a ChainImageDefinition to actual image data
 *
 * @param image_def - The image definition to resolve
 * @param previous_results - Array of previous call results
 * @param logger - Logger instance
 * @returns Resolved image data or null if resolution failed
 */
export function resolve_chain_image_definition(
  image_def: ChainImageDefinition,
  previous_results: ChainCallResult[],
  logger: Logger
): ResolvedImage | null {
  const image_b64 = resolve_chain_field(image_def.image_b64, previous_results, logger);
  const image_mime_type = resolve_chain_field(image_def.image_mime_type, previous_results, logger);

  if (!image_b64) {
    logger.error('Could not resolve image_b64 from definition', {
      file: FILE_NAME,
      data: {
        match_type: image_def.image_b64.match_type,
        value: image_def.image_b64.value,
      },
    });
    return null;
  }

  if (!image_mime_type) {
    logger.error('Could not resolve image_mime_type from definition', {
      file: FILE_NAME,
      data: {
        match_type: image_def.image_mime_type.match_type,
        value: image_def.image_mime_type.value,
      },
    });
    return null;
  }

  logger.debug('Resolved image definition', {
    file: FILE_NAME,
    data: {
      image_b64_length: image_b64.length,
      image_mime_type,
    },
  });

  return { image_b64, image_mime_type };
}

// =============================================================================
// Deep Merge Functions
// =============================================================================

/**
 * Deep merge two objects, with source values overwriting target values
 *
 * @param target - Target object
 * @param source - Source object to merge in
 * @returns New merged object
 */
export function deep_merge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };

  for (const key of Object.keys(source)) {
    const source_value = source[key];
    const target_value = result[key];

    if (
      source_value !== null &&
      typeof source_value === 'object' &&
      !Array.isArray(source_value) &&
      target_value !== null &&
      typeof target_value === 'object' &&
      !Array.isArray(target_value)
    ) {
      // Both are objects - recurse
      result[key] = deep_merge(
        target_value as Record<string, unknown>,
        source_value as Record<string, unknown>
      );
    } else {
      // Overwrite with source value
      result[key] = source_value;
    }
  }

  return result;
}

/**
 * Merge multiple call results into a single object
 *
 * @param results - Array of chain call results
 * @param logger - Logger instance
 * @returns Deep-merged object from all successful calls
 */
export function merge_chain_results(
  results: ChainCallResult[],
  logger: Logger
): Record<string, unknown> {
  let merged: Record<string, unknown> = {};

  for (const result of results) {
    if (result.success && result.parsed_result) {
      merged = deep_merge(merged, result.parsed_result);
      logger.debug('Merged result from call', {
        file: FILE_NAME,
        data: { call_index: result.call_index },
      });
    }
  }

  return merged;
}

// =============================================================================
// JSON Parsing Functions
// =============================================================================

/**
 * Attempt to parse LLM response text as JSON
 * Handles common LLM output formats (with markdown code blocks, etc.)
 *
 * @param text - Raw text response from LLM
 * @param logger - Logger instance
 * @returns Parsed JSON object or null if parsing fails
 */
export function parse_llm_json_response(
  text: string,
  logger: Logger
): Record<string, unknown> | null {
  // Try direct JSON parse first
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }
  } catch {
    // Continue to try other formats
  }

  // Try extracting JSON from markdown code block
  const code_block_match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (code_block_match) {
    try {
      const parsed = JSON.parse(code_block_match[1].trim());
      if (typeof parsed === 'object' && parsed !== null) {
        logger.debug('Extracted JSON from code block', { file: FILE_NAME });
        return parsed;
      }
    } catch {
      // Continue
    }
  }

  // Try finding first { to last }
  const first_brace = text.indexOf('{');
  const last_brace = text.lastIndexOf('}');

  if (first_brace !== -1 && last_brace > first_brace) {
    try {
      const json_substr = text.substring(first_brace, last_brace + 1);
      const parsed = JSON.parse(json_substr);
      if (typeof parsed === 'object' && parsed !== null) {
        logger.debug('Extracted JSON by brace matching', { file: FILE_NAME });
        return parsed;
      }
    } catch {
      // Continue
    }
  }

  logger.warn('Could not parse LLM response as JSON', {
    file: FILE_NAME,
    data: { text_preview: text.substring(0, 100) },
  });

  return null;
}

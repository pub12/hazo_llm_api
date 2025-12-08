/**
 * Variable Substitution Module
 * 
 * Functions to replace variables in prompt text.
 * Variables are prefixed with $ (e.g., $location, $name).
 * Values come from the prompt_variables JSON array.
 */

import type { Logger, PromptVariables } from '../llm_api/types.js';

// =============================================================================
// Variable Substitution Functions
// =============================================================================

/**
 * Substitute variables in prompt text with values from prompt_variables
 * Variables are identified by $ prefix (e.g., $location becomes "Tokyo")
 * 
 * @param prompt_text - The prompt text containing variables to replace
 * @param prompt_variables - Array of key-value objects with variable values
 *                           Format: [{ "variable1": "value1", "variable2": "value2" }]
 * @param logger - Logger instance
 * @returns The prompt text with all variables substituted
 */
export function substitute_variables(
  prompt_text: string,
  prompt_variables: PromptVariables | undefined,
  logger: Logger
): string {
  const file_name = 'substitute_variables.ts';
  
  // If no variables provided, return original text
  if (!prompt_variables || prompt_variables.length === 0) {
    return prompt_text;
  }
  
  let result_text = prompt_text;
  const substitutions_made: Record<string, string> = {};
  const missing_variables: string[] = [];
  
  // Flatten all variables from the array into a single object
  const all_variables: Record<string, string> = {};
  for (const var_obj of prompt_variables) {
    for (const [key, value] of Object.entries(var_obj)) {
      all_variables[key] = value;
    }
  }
  
  // Find all $variable patterns in the text
  const variable_pattern = /\$([a-zA-Z_][a-zA-Z0-9_]*)/g;
  const found_variables: string[] = [];
  let match;
  
  while ((match = variable_pattern.exec(prompt_text)) !== null) {
    const var_name = match[1];
    if (!found_variables.includes(var_name)) {
      found_variables.push(var_name);
    }
  }
  
  // Substitute each found variable
  for (const var_name of found_variables) {
    const var_pattern = new RegExp(`\\$${var_name}\\b`, 'g');
    
    if (var_name in all_variables) {
      const value = all_variables[var_name];
      result_text = result_text.replace(var_pattern, value);
      substitutions_made[`$${var_name}`] = value;
    } else {
      missing_variables.push(var_name);
      logger.warn(`Variable not found in prompt_variables: $${var_name}`, {
        file: file_name,
        line: 75,
        data: { variable: var_name, available_variables: Object.keys(all_variables) },
      });
    }
  }
  
  // Log variable substitution with before and after in one message
  if (Object.keys(substitutions_made).length > 0) {
    logger.debug('Variable substitution', {
      file: file_name,
      line: 83,
      data: {
        before: prompt_text,
        after: result_text,
        substitutions: substitutions_made,
      },
    });
  }
  
  return result_text;
}

/**
 * Parse prompt_variables from JSON string
 * @param json_string - JSON string containing prompt variables
 * @param logger - Logger instance
 * @returns Parsed prompt variables array, or empty array if parsing fails
 */
export function parse_prompt_variables(
  json_string: string | undefined | null,
  logger: Logger
): PromptVariables {
  const file_name = 'substitute_variables.ts';
  
  if (!json_string || json_string.trim() === '') {
    logger.debug('Empty or null prompt_variables string', {
      file: file_name,
      line: 118,
    });
    return [];
  }
  
  try {
    const parsed = JSON.parse(json_string);
    
    // Ensure it's an array
    if (!Array.isArray(parsed)) {
      logger.warn('prompt_variables is not an array, wrapping in array', {
        file: file_name,
        line: 129,
      });
      return [parsed];
    }
    
    logger.debug('Parsed prompt_variables successfully', {
      file: file_name,
      line: 135,
      data: { count: parsed.length },
    });
    
    return parsed;
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to parse prompt_variables JSON', {
      file: file_name,
      line: 143,
      data: { error: error_message },
    });
    return [];
  }
}

/**
 * Validate that all required variables are present
 * @param prompt_text - The prompt text containing variables
 * @param prompt_variables - The variables provided for substitution
 * @param logger - Logger instance
 * @returns Object with validation result and any missing variables
 */
export function validate_variables(
  prompt_text: string,
  prompt_variables: PromptVariables | undefined,
  logger: Logger
): { valid: boolean; missing_variables: string[] } {
  const file_name = 'substitute_variables.ts';
  
  // Find all variables in the prompt text
  const variable_pattern = /\$([a-zA-Z_][a-zA-Z0-9_]*)/g;
  const found_variables: string[] = [];
  let match;
  
  while ((match = variable_pattern.exec(prompt_text)) !== null) {
    const var_name = match[1];
    if (!found_variables.includes(var_name)) {
      found_variables.push(var_name);
    }
  }
  
  // If no variables in text, validation passes
  if (found_variables.length === 0) {
    logger.debug('No variables found in prompt text', {
      file: file_name,
      line: 180,
    });
    return { valid: true, missing_variables: [] };
  }
  
  // Flatten provided variables
  const all_variables: Record<string, string> = {};
  if (prompt_variables) {
    for (const var_obj of prompt_variables) {
      for (const [key, value] of Object.entries(var_obj)) {
        all_variables[key] = value;
      }
    }
  }
  
  // Check for missing variables
  const missing_variables: string[] = [];
  for (const var_name of found_variables) {
    if (!(var_name in all_variables)) {
      missing_variables.push(var_name);
    }
  }
  
  const valid = missing_variables.length === 0;
  
  logger.debug('Variable validation completed', {
    file: file_name,
    line: 206,
    data: {
      valid,
      found_variables,
      missing_variables,
    },
  });
  
  return { valid, missing_variables };
}


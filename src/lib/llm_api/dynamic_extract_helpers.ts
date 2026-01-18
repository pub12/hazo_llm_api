/**
 * Dynamic Extract Helper Functions
 *
 * Utility functions for parsing next_prompt configurations,
 * resolving dynamic values, and evaluating conditional branches.
 */

import type {
  Logger,
  NextPromptConfig,
  NextPromptBranch,
  NextPromptCondition,
  NextPromptOperator,
} from './types.js';
import { extract_jsonpath_value, extract_jsonpath_raw, is_valid_jsonpath } from './jsonpath_helper.js';

const FILE_NAME = 'dynamic_extract_helpers.ts';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of resolving next_prompt configuration
 */
export interface ResolvedNextPrompt {
  /** Resolved prompt area */
  prompt_area: string;

  /** Resolved prompt key */
  prompt_key: string;

  /** Which resolution method was used */
  resolution_type: 'simple' | 'branch' | 'default';

  /** Branch index if a branch was matched */
  branch_index?: number;
}

// =============================================================================
// Config Parsing
// =============================================================================

/**
 * Parse the next_prompt JSON string from database into NextPromptConfig
 *
 * @param json_string - JSON string from database next_prompt field
 * @param logger - Logger instance
 * @returns Parsed NextPromptConfig or null if invalid/empty
 *
 * @example
 * ```typescript
 * const config = parse_next_prompt_config('{"static_prompt_area": "doc"}', logger);
 * // Returns: { static_prompt_area: 'doc' }
 *
 * const empty = parse_next_prompt_config(null, logger);
 * // Returns: null
 * ```
 */
export function parse_next_prompt_config(
  json_string: string | null,
  logger: Logger
): NextPromptConfig | null {
  if (!json_string || json_string.trim() === '') {
    return null;
  }

  try {
    const parsed = JSON.parse(json_string);

    // Validate it's an object
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      logger.warn('next_prompt must be a JSON object', {
        file: FILE_NAME,
        data: { type: typeof parsed },
      });
      return null;
    }

    return parsed as NextPromptConfig;
  } catch (error) {
    logger.warn('Failed to parse next_prompt JSON', {
      file: FILE_NAME,
      data: {
        error: error instanceof Error ? error.message : String(error),
        json_preview: json_string.substring(0, 100),
      },
    });
    return null;
  }
}

// =============================================================================
// Condition Evaluation
// =============================================================================

/**
 * Compare two values using the specified operator
 *
 * @param left_value - Value from LLM output
 * @param operator - Comparison operator
 * @param right_value - Value from condition
 * @returns true if condition matches
 */
function compare_values(
  left_value: unknown,
  operator: NextPromptOperator,
  right_value: string | number | boolean
): boolean {
  // Handle null/undefined
  if (left_value === null || left_value === undefined) {
    // Only == and != can match null
    if (operator === '==') {
      return right_value === null || right_value === undefined;
    }
    if (operator === '!=') {
      return right_value !== null && right_value !== undefined;
    }
    return false;
  }

  // Type coercion for comparison
  const left = left_value;
  const right = right_value;

  switch (operator) {
    case '==':
      // Loose equality with type coercion
      if (typeof left === typeof right) {
        return left === right;
      }
      // String comparison for mixed types
      return String(left) === String(right);

    case '!=':
      if (typeof left === typeof right) {
        return left !== right;
      }
      return String(left) !== String(right);

    case '>':
    case '<':
    case '>=':
    case '<=': {
      // Numeric comparison
      const left_num = typeof left === 'number' ? left : parseFloat(String(left));
      const right_num = typeof right === 'number' ? right : parseFloat(String(right));

      if (isNaN(left_num) || isNaN(right_num)) {
        // Fall back to string comparison
        const left_str = String(left);
        const right_str = String(right);

        switch (operator) {
          case '>': return left_str > right_str;
          case '<': return left_str < right_str;
          case '>=': return left_str >= right_str;
          case '<=': return left_str <= right_str;
        }
      }

      switch (operator) {
        case '>': return left_num > right_num;
        case '<': return left_num < right_num;
        case '>=': return left_num >= right_num;
        case '<=': return left_num <= right_num;
      }
      break;
    }

    case 'contains':
      return String(left).includes(String(right));

    case 'startsWith':
      return String(left).startsWith(String(right));

    case 'endsWith':
      return String(left).endsWith(String(right));
  }

  return false;
}

/**
 * Evaluate a single condition against LLM output
 *
 * @param condition - The condition to evaluate
 * @param llm_output - Parsed JSON output from LLM
 * @param logger - Logger instance
 * @returns true if condition matches
 *
 * @example
 * ```typescript
 * const condition = { field: '$.total', operator: '>', value: 1000 };
 * const output = { total: 1500 };
 *
 * evaluate_condition(condition, output, logger);
 * // Returns: true
 * ```
 */
export function evaluate_condition(
  condition: NextPromptCondition,
  llm_output: Record<string, unknown>,
  logger: Logger
): boolean {
  // Validate field is a valid JSONPath
  if (!is_valid_jsonpath(condition.field)) {
    logger.warn('Invalid condition field JSONPath', {
      file: FILE_NAME,
      data: { field: condition.field },
    });
    return false;
  }

  // Extract the value from LLM output
  const actual_value = extract_jsonpath_raw(llm_output, condition.field, logger);

  // Compare values
  const result = compare_values(actual_value, condition.operator, condition.value);

  logger.debug('Evaluated condition', {
    file: FILE_NAME,
    data: {
      field: condition.field,
      operator: condition.operator,
      expected: condition.value,
      actual: actual_value,
      result,
    },
  });

  return result;
}

/**
 * Evaluate all conditions in a branch (AND logic)
 * All conditions must match for the branch to match
 *
 * @param branch - The branch to evaluate
 * @param llm_output - Parsed JSON output from LLM
 * @param logger - Logger instance
 * @returns true if all conditions match (or no conditions defined)
 */
export function evaluate_branch(
  branch: NextPromptBranch,
  llm_output: Record<string, unknown>,
  logger: Logger
): boolean {
  // No conditions = always match
  if (!branch.conditions || branch.conditions.length === 0) {
    return true;
  }

  // All conditions must match (AND logic)
  for (const condition of branch.conditions) {
    if (!evaluate_condition(condition, llm_output, logger)) {
      return false;
    }
  }

  return true;
}

// =============================================================================
// Branch Resolution
// =============================================================================

/**
 * Resolve prompt_area and prompt_key from a branch configuration
 *
 * @param branch - The branch configuration
 * @param llm_output - Parsed JSON output from LLM
 * @param logger - Logger instance
 * @returns Resolved { prompt_area, prompt_key } or null if resolution failed
 */
function resolve_branch_values(
  branch: NextPromptBranch,
  llm_output: Record<string, unknown>,
  logger: Logger
): { prompt_area: string; prompt_key: string } | null {
  // Resolve prompt_area (static takes precedence)
  let prompt_area: string | null = null;

  if (branch.static_prompt_area) {
    prompt_area = branch.static_prompt_area;
  } else if (branch.dynamic_prompt_area) {
    prompt_area = extract_jsonpath_value(llm_output, branch.dynamic_prompt_area, logger);
  }

  // Resolve prompt_key (static takes precedence)
  let prompt_key: string | null = null;

  if (branch.static_prompt_key) {
    prompt_key = branch.static_prompt_key;
  } else if (branch.dynamic_prompt_key) {
    prompt_key = extract_jsonpath_value(llm_output, branch.dynamic_prompt_key, logger);
  }

  // Both must be defined
  if (!prompt_area || !prompt_key) {
    logger.debug('Branch resolution incomplete', {
      file: FILE_NAME,
      data: {
        has_area: !!prompt_area,
        has_key: !!prompt_key,
        static_area: branch.static_prompt_area,
        dynamic_area: branch.dynamic_prompt_area,
        static_key: branch.static_prompt_key,
        dynamic_key: branch.dynamic_prompt_key,
      },
    });
    return null;
  }

  return { prompt_area, prompt_key };
}

/**
 * Find the first matching branch and resolve its values
 *
 * @param config - The NextPromptConfig
 * @param llm_output - Parsed JSON output from LLM
 * @param logger - Logger instance
 * @returns Resolved next prompt info or null
 */
export function find_matching_branch(
  config: NextPromptConfig,
  llm_output: Record<string, unknown>,
  logger: Logger
): ResolvedNextPrompt | null {
  // Try branches in order
  if (config.branches && config.branches.length > 0) {
    for (let i = 0; i < config.branches.length; i++) {
      const branch = config.branches[i];

      if (evaluate_branch(branch, llm_output, logger)) {
        const resolved = resolve_branch_values(branch, llm_output, logger);

        if (resolved) {
          logger.debug('Matched branch', {
            file: FILE_NAME,
            data: { branch_index: i, ...resolved },
          });

          return {
            ...resolved,
            resolution_type: 'branch',
            branch_index: i,
          };
        }
      }
    }
  }

  // Try default_branch
  if (config.default_branch) {
    const resolved = resolve_branch_values(config.default_branch, llm_output, logger);

    if (resolved) {
      logger.debug('Using default branch', {
        file: FILE_NAME,
        data: resolved,
      });

      return {
        ...resolved,
        resolution_type: 'default',
      };
    }
  }

  return null;
}

// =============================================================================
// Main Resolution Function
// =============================================================================

/**
 * Resolve next_prompt configuration to actual prompt_area and prompt_key
 *
 * Resolution priority:
 * 1. If branches defined: evaluate each branch in order, use first match
 * 2. If no branch matches and default_branch defined: use default_branch
 * 3. If no branches: use simple mode (static/dynamic values at root level)
 *
 * Within each branch/simple mode:
 * - static_prompt_area/key takes precedence over dynamic
 * - dynamic values are extracted from LLM output using JSONPath
 *
 * @param config - The NextPromptConfig
 * @param llm_output - Parsed JSON output from LLM
 * @param logger - Logger instance
 * @returns Resolved next prompt info or null if resolution failed
 *
 * @example
 * ```typescript
 * // Simple mode
 * const config = {
 *   static_prompt_area: 'doc',
 *   dynamic_prompt_key: '$.document_type'
 * };
 * const output = { document_type: 'invoice' };
 *
 * resolve_next_prompt(config, output, logger);
 * // Returns: { prompt_area: 'doc', prompt_key: 'invoice', resolution_type: 'simple' }
 *
 * // Conditional branching
 * const config2 = {
 *   branches: [
 *     {
 *       conditions: [{ field: '$.total', operator: '>', value: 1000 }],
 *       static_prompt_area: 'doc',
 *       static_prompt_key: 'high_value'
 *     }
 *   ],
 *   default_branch: {
 *     static_prompt_area: 'doc',
 *     dynamic_prompt_key: '$.document_type'
 *   }
 * };
 * ```
 */
export function resolve_next_prompt(
  config: NextPromptConfig,
  llm_output: Record<string, unknown>,
  logger: Logger
): ResolvedNextPrompt | null {
  // Check if branching mode is being used
  const has_branches = config.branches && config.branches.length > 0;
  const has_default = !!config.default_branch;

  if (has_branches || has_default) {
    // Branching mode
    return find_matching_branch(config, llm_output, logger);
  }

  // Simple mode (no branching)
  // Resolve prompt_area (static takes precedence)
  let prompt_area: string | null = null;

  if (config.static_prompt_area) {
    prompt_area = config.static_prompt_area;
  } else if (config.dynamic_prompt_area) {
    prompt_area = extract_jsonpath_value(llm_output, config.dynamic_prompt_area, logger);
  }

  // Resolve prompt_key (static takes precedence)
  let prompt_key: string | null = null;

  if (config.static_prompt_key) {
    prompt_key = config.static_prompt_key;
  } else if (config.dynamic_prompt_key) {
    prompt_key = extract_jsonpath_value(llm_output, config.dynamic_prompt_key, logger);
  }

  // Both must be defined
  if (!prompt_area || !prompt_key) {
    logger.debug('Simple mode resolution incomplete', {
      file: FILE_NAME,
      data: {
        has_area: !!prompt_area,
        has_key: !!prompt_key,
      },
    });
    return null;
  }

  logger.debug('Resolved simple mode next_prompt', {
    file: FILE_NAME,
    data: { prompt_area, prompt_key },
  });

  return {
    prompt_area,
    prompt_key,
    resolution_type: 'simple',
  };
}

/**
 * Validate that a NextPromptConfig has at least one valid configuration
 * At minimum, must have either:
 * - Both static_prompt_area and static_prompt_key (or dynamic equivalents)
 * - At least one branch with valid area/key configuration
 * - A default_branch with valid area/key configuration
 *
 * @param config - The NextPromptConfig to validate
 * @returns true if config is valid
 */
export function validate_next_prompt_config(config: NextPromptConfig): boolean {
  // Check simple mode
  const has_simple_area = !!(config.static_prompt_area || config.dynamic_prompt_area);
  const has_simple_key = !!(config.static_prompt_key || config.dynamic_prompt_key);

  if (has_simple_area && has_simple_key) {
    return true;
  }

  // Check branches
  if (config.branches && config.branches.length > 0) {
    for (const branch of config.branches) {
      const has_area = !!(branch.static_prompt_area || branch.dynamic_prompt_area);
      const has_key = !!(branch.static_prompt_key || branch.dynamic_prompt_key);

      if (has_area && has_key) {
        return true;
      }
    }
  }

  // Check default_branch
  if (config.default_branch) {
    const has_area = !!(config.default_branch.static_prompt_area || config.default_branch.dynamic_prompt_area);
    const has_key = !!(config.default_branch.static_prompt_key || config.default_branch.dynamic_prompt_key);

    if (has_area && has_key) {
      return true;
    }
  }

  return false;
}

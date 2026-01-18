/**
 * JSONPath Helper Functions
 *
 * Simple JSONPath implementation for extracting values from objects.
 * Supports basic JSONPath expressions like $.field, $.nested.field, $.array[0].field
 */

import type { Logger } from './types.js';

const FILE_NAME = 'jsonpath_helper.ts';

// =============================================================================
// JSONPath Validation
// =============================================================================

/**
 * Validate a JSONPath expression
 * Supports: $.field, $.nested.field, $.array[0], $.array[0].field
 *
 * @param path - JSONPath expression to validate
 * @returns true if valid, false otherwise
 *
 * @example
 * ```typescript
 * is_valid_jsonpath('$.document_type'); // true
 * is_valid_jsonpath('$.data.nested.value'); // true
 * is_valid_jsonpath('$.items[0].name'); // true
 * is_valid_jsonpath('document_type'); // false (missing $.)
 * is_valid_jsonpath('$document_type'); // false (missing .)
 * ```
 */
export function is_valid_jsonpath(path: string): boolean {
  if (!path || typeof path !== 'string') {
    return false;
  }

  // Must start with $.
  if (!path.startsWith('$.')) {
    return false;
  }

  // Get the path after $.
  const rest = path.slice(2);

  // Cannot be empty after $.
  if (!rest) {
    return false;
  }

  // Validate path structure: field names, dots, and array indices
  // Valid patterns: field, field.subfield, field[0], field[0].subfield
  const pattern = /^[a-zA-Z_][a-zA-Z0-9_]*(\[\d+\])?(\.[a-zA-Z_][a-zA-Z0-9_]*(\[\d+\])?)*$/;
  return pattern.test(rest);
}

// =============================================================================
// JSONPath Extraction
// =============================================================================

/**
 * Parse a JSONPath expression into path segments
 * Handles both dot notation and array index notation
 *
 * @param path - JSONPath expression (e.g., "$.data.items[0].name")
 * @returns Array of path segments
 *
 * @example
 * parse_jsonpath_segments('$.data.items[0].name')
 * // Returns: ['data', 'items', 0, 'name']
 */
function parse_jsonpath_segments(path: string): (string | number)[] {
  // Remove $. prefix
  const rest = path.slice(2);

  const segments: (string | number)[] = [];
  let current = '';

  for (let i = 0; i < rest.length; i++) {
    const char = rest[i];

    if (char === '.') {
      // End of current segment
      if (current) {
        segments.push(current);
        current = '';
      }
    } else if (char === '[') {
      // Start of array index
      if (current) {
        segments.push(current);
        current = '';
      }

      // Find closing bracket
      const end_bracket = rest.indexOf(']', i);
      if (end_bracket === -1) {
        // Invalid syntax, treat rest as literal
        current = rest.slice(i);
        break;
      }

      const index_str = rest.slice(i + 1, end_bracket);
      const index = parseInt(index_str, 10);

      if (!isNaN(index)) {
        segments.push(index);
      }

      i = end_bracket; // Skip to closing bracket
    } else {
      current += char;
    }
  }

  // Don't forget the last segment
  if (current) {
    segments.push(current);
  }

  return segments;
}

/**
 * Extract a value from an object using JSONPath expression
 *
 * @param obj - The object to extract from
 * @param path - JSONPath expression (e.g., "$.document_type", "$.data.nested")
 * @param logger - Logger instance for debugging
 * @returns The extracted value as string, or null if not found
 *
 * @example
 * ```typescript
 * const obj = { document_type: 'invoice', data: { total: 100 } };
 *
 * extract_jsonpath_value(obj, '$.document_type', logger);
 * // Returns: 'invoice'
 *
 * extract_jsonpath_value(obj, '$.data.total', logger);
 * // Returns: '100'
 *
 * extract_jsonpath_value(obj, '$.missing', logger);
 * // Returns: null
 * ```
 */
export function extract_jsonpath_value(
  obj: Record<string, unknown>,
  path: string,
  logger: Logger
): string | null {
  // Validate path
  if (!is_valid_jsonpath(path)) {
    logger.warn('Invalid JSONPath expression', {
      file: FILE_NAME,
      data: { path, reason: 'must start with $. and contain valid field names' },
    });
    return null;
  }

  // Parse into segments
  const segments = parse_jsonpath_segments(path);

  if (segments.length === 0) {
    logger.warn('Empty JSONPath segments', {
      file: FILE_NAME,
      data: { path },
    });
    return null;
  }

  // Traverse the object
  let current: unknown = obj;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      logger.debug('JSONPath traversal hit null/undefined', {
        file: FILE_NAME,
        data: { path, failed_at: segment },
      });
      return null;
    }

    if (typeof segment === 'number') {
      // Array access
      if (!Array.isArray(current)) {
        logger.debug('JSONPath array access on non-array', {
          file: FILE_NAME,
          data: { path, segment, type: typeof current },
        });
        return null;
      }

      if (segment < 0 || segment >= current.length) {
        logger.debug('JSONPath array index out of bounds', {
          file: FILE_NAME,
          data: { path, segment, length: current.length },
        });
        return null;
      }

      current = current[segment];
    } else {
      // Object property access
      if (typeof current !== 'object' || current === null) {
        logger.debug('JSONPath property access on non-object', {
          file: FILE_NAME,
          data: { path, segment, type: typeof current },
        });
        return null;
      }

      current = (current as Record<string, unknown>)[segment];
    }
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
  try {
    return JSON.stringify(current);
  } catch {
    logger.warn('Failed to stringify JSONPath result', {
      file: FILE_NAME,
      data: { path, type: typeof current },
    });
    return null;
  }
}

/**
 * Extract a raw value from an object using JSONPath expression
 * Unlike extract_jsonpath_value, this returns the actual value without string conversion
 *
 * @param obj - The object to extract from
 * @param path - JSONPath expression
 * @param logger - Logger instance
 * @returns The extracted value (any type), or undefined if not found
 */
export function extract_jsonpath_raw(
  obj: Record<string, unknown>,
  path: string,
  logger: Logger
): unknown {
  // Validate path
  if (!is_valid_jsonpath(path)) {
    logger.warn('Invalid JSONPath expression', {
      file: FILE_NAME,
      data: { path },
    });
    return undefined;
  }

  // Parse into segments
  const segments = parse_jsonpath_segments(path);

  if (segments.length === 0) {
    return undefined;
  }

  // Traverse the object
  let current: unknown = obj;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof segment === 'number') {
      // Array access
      if (!Array.isArray(current)) {
        return undefined;
      }

      if (segment < 0 || segment >= current.length) {
        return undefined;
      }

      current = current[segment];
    } else {
      // Object property access
      if (typeof current !== 'object' || current === null) {
        return undefined;
      }

      current = (current as Record<string, unknown>)[segment];
    }
  }

  return current;
}

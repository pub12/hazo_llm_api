/**
 * Configuration Parser Module
 *
 * Generic configuration parsing utilities for LLM providers.
 * Provides a unified approach to parsing generation configs from INI files.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ini from 'ini';
import type { ServiceType } from '../providers/types.js';
import { SERVICE_TYPES } from '../providers/types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Generic generation config that works across providers
 * Each provider can extend this with their specific fields
 */
export interface BaseGenerationConfig {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
}

/**
 * Parameter mapping definition for config parsing
 * Maps internal field names to possible INI key variations
 */
export interface ParameterMapping {
  /** Internal field name */
  field: string;
  /** Possible keys in INI file (checked in order) */
  keys: string[];
  /** Type of the parameter */
  type: 'number' | 'string' | 'json_array';
}

/**
 * Standard parameter mappings for common generation config fields
 * Each provider can use these or define their own
 */
export const COMMON_PARAM_MAPPINGS: ParameterMapping[] = [
  { field: 'temperature', keys: ['temperature'], type: 'number' },
  { field: 'max_tokens', keys: ['maxOutputTokens', 'max_output_tokens', 'max_tokens'], type: 'number' },
  { field: 'top_p', keys: ['topP', 'top_p'], type: 'number' },
  { field: 'top_k', keys: ['topK', 'top_k'], type: 'number' },
  { field: 'candidate_count', keys: ['candidateCount', 'candidate_count', 'n'], type: 'number' },
  { field: 'stop_sequences', keys: ['stopSequences', 'stop_sequences', 'stop'], type: 'json_array' },
  { field: 'response_mime_type', keys: ['responseMimeType', 'response_mime_type'], type: 'string' },
  { field: 'presence_penalty', keys: ['presence_penalty'], type: 'number' },
  { field: 'frequency_penalty', keys: ['frequency_penalty'], type: 'number' },
];

/**
 * Gemini-specific parameter mappings
 */
export const GEMINI_PARAM_MAPPINGS: ParameterMapping[] = [
  { field: 'temperature', keys: ['temperature'], type: 'number' },
  { field: 'max_output_tokens', keys: ['maxOutputTokens', 'max_output_tokens'], type: 'number' },
  { field: 'top_p', keys: ['topP', 'top_p'], type: 'number' },
  { field: 'top_k', keys: ['topK', 'top_k'], type: 'number' },
  { field: 'candidate_count', keys: ['candidateCount', 'candidate_count'], type: 'number' },
  { field: 'stop_sequences', keys: ['stopSequences', 'stop_sequences'], type: 'json_array' },
  { field: 'response_mime_type', keys: ['responseMimeType', 'response_mime_type'], type: 'string' },
];

/**
 * Qwen-specific parameter mappings
 */
export const QWEN_PARAM_MAPPINGS: ParameterMapping[] = [
  { field: 'temperature', keys: ['temperature'], type: 'number' },
  { field: 'max_tokens', keys: ['max_tokens'], type: 'number' },
  { field: 'top_p', keys: ['top_p'], type: 'number' },
  { field: 'top_k', keys: ['top_k'], type: 'number' },
  { field: 'n', keys: ['n'], type: 'number' },
  { field: 'stop', keys: ['stop'], type: 'json_array' },
  { field: 'presence_penalty', keys: ['presence_penalty'], type: 'number' },
  { field: 'frequency_penalty', keys: ['frequency_penalty'], type: 'number' },
];

// =============================================================================
// Config File Utilities
// =============================================================================

/**
 * Find the config file path
 * Searches in config/ subdirectory and parent directories
 *
 * @param filename - Config filename to search for (default: hazo_llm_api_config.ini)
 * @returns The path to the config file or null if not found
 */
export function find_config_file(filename = 'hazo_llm_api_config.ini'): string | null {
  // Search paths: config/ in current dir, parent dir, grandparent dir
  const search_paths = [
    path.join(process.cwd(), 'config', filename),
    path.join(process.cwd(), '..', 'config', filename),
    path.join(process.cwd(), '..', '..', 'config', filename),
  ];

  for (const config_path of search_paths) {
    try {
      if (fs.existsSync(config_path)) {
        return config_path;
      }
    } catch {
      // Continue to next path
    }
  }

  return null;
}

/**
 * Read and parse an INI config file
 *
 * @param config_path - Path to the config file
 * @returns Parsed config object or null if reading fails
 */
export function read_config_file(config_path: string): Record<string, Record<string, string>> | null {
  try {
    const config_content = fs.readFileSync(config_path, 'utf-8');
    return ini.parse(config_content) as Record<string, Record<string, string>>;
  } catch {
    return null;
  }
}

// =============================================================================
// Generation Config Parsing
// =============================================================================

/**
 * Parse a generation config from an INI section using parameter mappings
 *
 * This is a generic parser that works with any provider by using
 * configurable parameter mappings.
 *
 * @param section - The parsed INI section object
 * @param mappings - Array of parameter mappings to use
 * @param prefix - Optional prefix to prepend to all keys (e.g., "text_" or "image_")
 * @returns Parsed config object or undefined if no params set
 *
 * @example
 * ```typescript
 * // Parse Gemini text config
 * const text_config = parse_generation_config(
 *   gemini_section,
 *   GEMINI_PARAM_MAPPINGS,
 *   'text_'
 * );
 *
 * // Parse Qwen image config
 * const image_config = parse_generation_config(
 *   qwen_section,
 *   QWEN_PARAM_MAPPINGS,
 *   'image_'
 * );
 * ```
 */
export function parse_generation_config<T extends Record<string, unknown>>(
  section: Record<string, string> | undefined,
  mappings: ParameterMapping[],
  prefix?: string
): T | undefined {
  if (!section) {
    return undefined;
  }

  const config: Record<string, unknown> = {};
  let has_params = false;

  for (const mapping of mappings) {
    const value = get_config_value(section, mapping.keys, prefix);

    if (value !== undefined) {
      const parsed = parse_value(value, mapping.type);
      if (parsed !== undefined) {
        config[mapping.field] = parsed;
        has_params = true;
      }
    }
  }

  return has_params ? (config as T) : undefined;
}

/**
 * Get a config value from a section, checking multiple possible keys
 *
 * @param section - INI section object
 * @param keys - Array of possible key names to check
 * @param prefix - Optional prefix to prepend to all keys
 * @returns The first found value or undefined
 */
function get_config_value(
  section: Record<string, string>,
  keys: string[],
  prefix?: string
): string | undefined {
  for (const key of keys) {
    const full_key = prefix ? `${prefix}${key}` : key;
    if (section[full_key] !== undefined) {
      return section[full_key];
    }
  }
  return undefined;
}

/**
 * Parse a string value to the appropriate type
 *
 * @param value - String value from config
 * @param type - Expected type
 * @returns Parsed value or undefined if parsing fails
 */
function parse_value(value: string, type: 'number' | 'string' | 'json_array'): unknown {
  switch (type) {
    case 'number': {
      const num = parseFloat(value);
      return isNaN(num) ? undefined : num;
    }
    case 'string':
      return value;
    case 'json_array':
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined;
      } catch {
        return undefined;
      }
  }
}

// =============================================================================
// Capabilities and LLM List Parsing
// =============================================================================

/**
 * Parse capabilities from config value (JSON array or comma-separated)
 *
 * @param value - Capabilities value from config
 * @returns Array of ServiceType or empty array
 */
export function parse_capabilities(value: string | undefined): ServiceType[] {
  if (!value) {
    return [];
  }

  try {
    // Try parsing as JSON array first
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((cap) =>
        Object.values(SERVICE_TYPES).includes(cap as ServiceType)
      ) as ServiceType[];
    }
  } catch {
    // Not JSON, try comma-separated
    const caps = value
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    return caps.filter((cap) =>
      Object.values(SERVICE_TYPES).includes(cap as ServiceType)
    ) as ServiceType[];
  }

  return [];
}

/**
 * Parse enabled_llms from config (JSON array or comma-separated)
 *
 * @param value - Enabled LLMs value from config
 * @param default_value - Default value if parsing fails
 * @returns Array of LLM names
 */
export function parse_enabled_llms(
  value: string | undefined,
  default_value: string[] = ['gemini']
): string[] {
  if (!value) {
    return default_value;
  }

  try {
    // Try parsing as JSON array first
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      const valid = parsed.filter(
        (name): name is string => typeof name === 'string' && name.length > 0
      );
      return valid.length > 0 ? valid : default_value;
    }
  } catch {
    // Not JSON, try comma-separated
    const names = value
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    return names.length > 0 ? names : default_value;
  }

  return default_value;
}

// =============================================================================
// Environment Variable Utilities
// =============================================================================

/**
 * Load API key from environment variable
 *
 * @param provider_name - Provider name (e.g., "gemini", "qwen", "openai")
 * @returns API key or undefined if not found
 */
export function load_api_key_from_env(provider_name: string): string | undefined {
  // Try provider-specific env var: GEMINI_API_KEY, OPENAI_API_KEY, etc.
  const env_var_name = `${provider_name.toUpperCase()}_API_KEY`;
  return process.env[env_var_name];
}

/**
 * Get the environment variable name for a provider's API key
 *
 * @param provider_name - Provider name
 * @returns Environment variable name
 */
export function get_api_key_env_var_name(provider_name: string): string {
  return `${provider_name.toUpperCase()}_API_KEY`;
}

// =============================================================================
// Global Config Reading
// =============================================================================

/**
 * Global LLM configuration from [llm] section
 */
export interface GlobalLLMConfig {
  enabled_llms: string[];
  primary_llm: string;
  sqlite_path: string;
}

/**
 * Read LLM global config from [llm] section
 *
 * @returns Object with enabled_llms, primary_llm, and sqlite_path
 */
export function get_llm_global_config(): GlobalLLMConfig {
  const config_path = find_config_file();
  const defaults: GlobalLLMConfig = {
    enabled_llms: ['gemini'],
    primary_llm: 'gemini',
    sqlite_path: 'prompt_library.sqlite',
  };

  if (!config_path) {
    return defaults;
  }

  const config = read_config_file(config_path);
  if (!config) {
    return defaults;
  }

  const llm_section = config.llm || {};
  const enabled_llms = parse_enabled_llms(llm_section.enabled_llms);
  const primary_llm = llm_section.primary_llm || defaults.primary_llm;
  const sqlite_path = llm_section.sqlite_path || defaults.sqlite_path;

  return {
    enabled_llms: enabled_llms.length > 0 ? enabled_llms : defaults.enabled_llms,
    primary_llm,
    sqlite_path,
  };
}

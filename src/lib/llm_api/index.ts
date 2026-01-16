/**
 * LLM API Module
 *
 * Main entry point for the LLM API functionality.
 * Provides initialization and specialized LLM functions:
 * - hazo_llm_text_text: Text input → Text output
 * - hazo_llm_image_text: Image input → Text output
 * - hazo_llm_text_image: Text input → Image output
 * - hazo_llm_image_image: Image input → Image output
 * - hazo_llm_document_text: Document input → Text output (PDF analysis)
 * - hazo_llm_text_image_text: Text → Image → Text (chained)
 * - hazo_llm_image_image_text: Images → Image → Text (chained)
 *
 * Database is auto-initialized on module import using config defaults.
 */

import type {
  LLMApiConfig,
  LLMApiClient,
  LLMResponse,
  LLMStreamResponse,
  LLMStreamChunk,
  TextTextParams,
  ImageTextParams,
  TextImageParams,
  ImageImageParams,
  DocumentTextParams,
  TextImageTextParams,
  ImageImageTextParams,
  PromptChainParams,
  PromptChainResponse,
  Logger,
  GeminiGenerationConfig,
} from './types.js';
import { LLM_ERROR_CODES } from './types.js';
import { initialize_database, get_database } from '../database/init_database.js';
import { hazo_llm_text_text as hazo_llm_text_text_internal } from './hazo_llm_text_text.js';
import { hazo_llm_image_text as hazo_llm_image_text_internal } from './hazo_llm_image_text.js';
import { hazo_llm_text_image as hazo_llm_text_image_internal } from './hazo_llm_text_image.js';
import { hazo_llm_image_image as hazo_llm_image_image_internal } from './hazo_llm_image_image.js';
import { hazo_llm_text_image_text as hazo_llm_text_image_text_internal } from './hazo_llm_text_image_text.js';
import { hazo_llm_image_image_text as hazo_llm_image_image_text_internal } from './hazo_llm_image_image_text.js';
import { hazo_llm_prompt_chain as hazo_llm_prompt_chain_internal } from './hazo_llm_prompt_chain.js';
import { hazo_llm_document_text as hazo_llm_document_text_internal } from './hazo_llm_document_text.js';
import { get_gemini_api_url } from '../providers/gemini/gemini_client.js';
import {
  register_provider,
  set_enabled_llms,
  set_primary_llm,
  get_primary_llm,
  get_registered_providers,
  get_provider,
} from '../providers/registry.js';
import { GeminiProvider, type GeminiProviderConfig } from '../providers/gemini/index.js';
import { QwenProvider, type QwenProviderConfig, type QwenGenerationConfig } from '../providers/qwen/index.js';
import type { ServiceType, ProviderName } from '../providers/types.js';
import { SERVICE_TYPES, LLM_PROVIDERS } from '../providers/types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as ini from 'ini';

// =============================================================================
// Module State
// =============================================================================

let initialized = false;
let db_auto_initialized = false;
let current_config: LLMApiConfig | null = null;

// =============================================================================
// Default Logger
// =============================================================================

/**
 * Default console logger used when no custom logger is provided
 * Can be used directly or as a fallback in functions
 */
export const default_logger: Logger = {
  error: (message: string, meta?: Record<string, unknown>) => {
    console.error(`[HAZO_LLM_API ERROR] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  },
  info: (message: string, meta?: Record<string, unknown>) => {
    console.log(`[HAZO_LLM_API INFO] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    console.warn(`[HAZO_LLM_API WARN] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  },
  debug: (message: string, meta?: Record<string, unknown>) => {
    console.debug(`[HAZO_LLM_API DEBUG] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  },
};

/**
 * Stored logger instance - set during initialization
 */
let stored_logger: Logger = default_logger;

/**
 * Stored hooks instance - set during initialization
 */
let stored_hooks: import('./types.js').LLMHooks = {};

/**
 * Get the current logger instance
 * Returns the stored logger (set during initialization) or default logger
 *
 * @returns Current logger instance
 *
 * @example
 * ```typescript
 * import { get_logger } from 'hazo_llm_api/server';
 *
 * const logger = get_logger();
 * logger.info('My message');
 * ```
 */
export function get_logger(): Logger {
  return stored_logger;
}

/**
 * Set the logger instance
 * Called internally during initialization, but can also be called directly
 *
 * @param logger - Logger instance to use
 */
export function set_logger(logger: Logger): void {
  stored_logger = logger;
}

/**
 * Get the current hooks configuration
 *
 * @returns Current hooks configuration
 */
export function get_hooks(): import('./types.js').LLMHooks {
  return stored_hooks;
}

/**
 * Set the hooks configuration
 * Called internally during initialization, but can also be called directly
 *
 * @param hooks - Hooks configuration to use
 */
export function set_hooks(hooks: import('./types.js').LLMHooks): void {
  stored_hooks = hooks;
}

// =============================================================================
// Config Reader
// =============================================================================

/**
 * Find the config file path
 * Searches in config/ subdirectory and parent directories
 * @returns The path to the config file or null if not found
 */
function find_config_file(): string | null {
  const config_filename = 'hazo_llm_api_config.ini';

  // Search paths: config/ in current dir, parent dir, grandparent dir
  const search_paths = [
    path.join(process.cwd(), 'config', config_filename),
    path.join(process.cwd(), '..', 'config', config_filename),
    path.join(process.cwd(), '..', '..', 'config', config_filename),
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
 * Read sqlite_path from hazo_llm_api_config.ini file
 * Searches in current directory and parent directories
 */
function get_sqlite_path_from_config(): string {
  const default_path = 'prompt_library.sqlite';
  
  const config_path = find_config_file();
  if (config_path) {
    try {
      const config_content = fs.readFileSync(config_path, 'utf-8');
      const config = ini.parse(config_content);
      const sqlite_path = config.llm?.sqlite_path;
      
      if (sqlite_path) {
        default_logger.debug('Found sqlite_path in config', {
          file: 'index.ts',
          line: 137,
          data: { config_path, sqlite_path },
        });
        return sqlite_path;
      }
    } catch {
      // Use default
    }
  }
  
  default_logger.debug('Using default sqlite_path', {
    file: 'index.ts',
    line: 150,
    data: { default_path },
  });
  
  return default_path;
}

/**
 * Parse a generation config section from the ini file
 * Only includes parameters that are explicitly set (not commented out)
 * @param section - The parsed ini section object
 * @returns GeminiGenerationConfig or undefined if no params set
 */
function parse_generation_config(section: Record<string, string> | undefined): GeminiGenerationConfig | undefined {
  if (!section) {
    return undefined;
  }
  
  const config: GeminiGenerationConfig = {};
  let has_params = false;
  
  // Parse temperature (number)
  if (section.temperature !== undefined) {
    const temp = parseFloat(section.temperature);
    if (!isNaN(temp)) {
      config.temperature = temp;
      has_params = true;
    }
  }
  
  // Parse maxOutputTokens / max_output_tokens (number)
  const max_tokens = section.maxOutputTokens || section.max_output_tokens;
  if (max_tokens !== undefined) {
    const tokens = parseInt(max_tokens, 10);
    if (!isNaN(tokens)) {
      config.max_output_tokens = tokens;
      has_params = true;
    }
  }
  
  // Parse topP / top_p (number)
  const top_p = section.topP || section.top_p;
  if (top_p !== undefined) {
    const p = parseFloat(top_p);
    if (!isNaN(p)) {
      config.top_p = p;
      has_params = true;
    }
  }
  
  // Parse topK / top_k (number)
  const top_k = section.topK || section.top_k;
  if (top_k !== undefined) {
    const k = parseInt(top_k, 10);
    if (!isNaN(k)) {
      config.top_k = k;
      has_params = true;
    }
  }
  
  // Parse candidateCount / candidate_count (number)
  const candidate_count = section.candidateCount || section.candidate_count;
  if (candidate_count !== undefined) {
    const count = parseInt(candidate_count, 10);
    if (!isNaN(count)) {
      config.candidate_count = count;
      has_params = true;
    }
  }
  
  // Parse stopSequences / stop_sequences (JSON array string)
  const stop_sequences = section.stopSequences || section.stop_sequences;
  if (stop_sequences !== undefined) {
    try {
      const sequences = JSON.parse(stop_sequences);
      if (Array.isArray(sequences) && sequences.length > 0) {
        config.stop_sequences = sequences;
        has_params = true;
      }
    } catch {
      // Invalid JSON, skip
    }
  }
  
  // Parse responseMimeType / response_mime_type (string)
  const response_mime_type = section.responseMimeType || section.response_mime_type;
  if (response_mime_type !== undefined) {
    config.response_mime_type = response_mime_type;
    has_params = true;
  }
  
  return has_params ? config : undefined;
}

/**
 * Parse generation config from a section with optional prefix
 * Supports prefixed configs like "text_temperature" or "image_temperature"
 * @param section - The parsed ini section object
 * @param prefix - Optional prefix to filter keys (e.g., "text_" or "image_")
 * @returns GeminiGenerationConfig or undefined if no params set
 */
function parse_prefixed_generation_config(
  section: Record<string, string> | undefined,
  prefix?: string
): GeminiGenerationConfig | undefined {
  if (!section) {
    return undefined;
  }
  
  const config: GeminiGenerationConfig = {};
  let has_params = false;
  
  // Helper to get value with or without prefix
  const get_value = (key: string): string | undefined => {
    if (prefix) {
      return section[`${prefix}${key}`];
    }
    return section[key];
  };
  
  // Parse temperature (number)
  const temp = get_value('temperature');
  if (temp !== undefined) {
    const temp_val = parseFloat(temp);
    if (!isNaN(temp_val)) {
      config.temperature = temp_val;
      has_params = true;
    }
  }
  
  // Parse maxOutputTokens (number)
  const max_tokens = get_value('maxOutputTokens') || get_value('max_output_tokens');
  if (max_tokens !== undefined) {
    const tokens = parseInt(max_tokens, 10);
    if (!isNaN(tokens)) {
      config.max_output_tokens = tokens;
      has_params = true;
    }
  }
  
  // Parse topP (number)
  const top_p = get_value('topP') || get_value('top_p');
  if (top_p !== undefined) {
    const p = parseFloat(top_p);
    if (!isNaN(p)) {
      config.top_p = p;
      has_params = true;
    }
  }
  
  // Parse topK (number)
  const top_k = get_value('topK') || get_value('top_k');
  if (top_k !== undefined) {
    const k = parseInt(top_k, 10);
    if (!isNaN(k)) {
      config.top_k = k;
      has_params = true;
    }
  }
  
  // Parse candidateCount (number)
  const candidate_count = get_value('candidateCount') || get_value('candidate_count');
  if (candidate_count !== undefined) {
    const count = parseInt(candidate_count, 10);
    if (!isNaN(count)) {
      config.candidate_count = count;
      has_params = true;
    }
  }
  
  // Parse stopSequences (JSON array string)
  const stop_sequences = get_value('stopSequences') || get_value('stop_sequences');
  if (stop_sequences !== undefined) {
    try {
      const sequences = JSON.parse(stop_sequences);
      if (Array.isArray(sequences) && sequences.length > 0) {
        config.stop_sequences = sequences;
        has_params = true;
      }
    } catch {
      // Invalid JSON, skip
    }
  }
  
  // Parse responseMimeType (string)
  const response_mime_type = get_value('responseMimeType') || get_value('response_mime_type');
  if (response_mime_type !== undefined) {
    config.response_mime_type = response_mime_type;
    has_params = true;
  }
  
  return has_params ? config : undefined;
}

/**
 * Parse capabilities from config value (JSON array or comma-separated)
 * @param value - Capabilities value from config
 * @returns Array of ServiceType or empty array
 */
function parse_capabilities(value: string | undefined): ServiceType[] {
  if (!value) {
    return [];
  }
  
  try {
    // Try parsing as JSON array first
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter(cap => Object.values(SERVICE_TYPES).includes(cap as ServiceType)) as ServiceType[];
    }
  } catch {
    // Not JSON, try comma-separated
    const caps = value.split(',').map(c => c.trim()).filter(Boolean);
    return caps.filter(cap => Object.values(SERVICE_TYPES).includes(cap as ServiceType)) as ServiceType[];
  }
  
  return [];
}

/**
 * Parse enabled_llms from config (JSON array or comma-separated)
 * @param value - Enabled LLMs value from config
 * @returns Array of LLM names
 */
function parse_enabled_llms(value: string | undefined): string[] {
  if (!value) {
    return ['gemini']; // Default to gemini
  }
  
  try {
    // Try parsing as JSON array first
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((name): name is string => typeof name === 'string' && name.length > 0);
    }
  } catch {
    // Not JSON, try comma-separated
    return value.split(',').map(name => name.trim()).filter(Boolean);
  }
  
  return [];
}

/**
 * Load API key from environment variable
 * @param provider_name - Provider name (e.g., "gemini")
 * @returns API key or undefined if not found
 */
function load_api_key_from_env(provider_name: string): string | undefined {
  // Try provider-specific env var: GEMINI_API_KEY, OPENAI_API_KEY, etc.
  const env_var_name = `${provider_name.toUpperCase()}_API_KEY`;
  return process.env[env_var_name];
}

/**
 * Read LLM global config from [llm] section
 * @returns Object with enabled_llms and primary_llm
 */
function get_llm_global_config(): {
  enabled_llms: string[];
  primary_llm: string;
  sqlite_path: string;
} {
  const config_path = find_config_file();
  const default_enabled = ['gemini'];
  const default_primary = 'gemini';
  const default_sqlite = 'prompt_library.sqlite';
  
  if (!config_path) {
    return {
      enabled_llms: default_enabled,
      primary_llm: default_primary,
      sqlite_path: default_sqlite,
    };
  }
  
  try {
    const config_content = fs.readFileSync(config_path, 'utf-8');
    const config = ini.parse(config_content);
    const llm_section = config.llm || {};
    
    const enabled_llms = parse_enabled_llms(llm_section.enabled_llms);
    const primary_llm = llm_section.primary_llm || default_primary;
    const sqlite_path = llm_section.sqlite_path || default_sqlite;
    
    return {
      enabled_llms: enabled_llms.length > 0 ? enabled_llms : default_enabled,
      primary_llm,
      sqlite_path,
    };
  } catch {
    return {
      enabled_llms: default_enabled,
      primary_llm: default_primary,
      sqlite_path: default_sqlite,
    };
  }
}

/**
 * Load and initialize Gemini provider from config
 * @param logger - Logger instance
 * @returns GeminiProvider instance or null if config invalid
 */
function load_gemini_provider_from_config(logger: Logger): GeminiProvider | null {
  const config_path = find_config_file();
  if (!config_path) {
    logger.warn('Config file not found, cannot load Gemini provider', {
      file: 'index.ts',
      line: 340,
    });
    return null;
  }

  try {
    const config_content = fs.readFileSync(config_path, 'utf-8');
    const config = ini.parse(config_content);
    const gemini_section = config.llm_gemini || {};

    // Support custom env var name via api_key_env config option
    const env_var_name = gemini_section.api_key_env || 'GEMINI_API_KEY';
    const api_key = process.env[env_var_name];

    if (!api_key) {
      logger.error(`${env_var_name} not found in environment variables`, {
        file: 'index.ts',
        line: 352,
        data: { config_path, env_var_name },
      });
      return null;
    }
    
    // Parse capabilities
    const capabilities = parse_capabilities(gemini_section.capabilities);
    
    // Parse generation configs with prefixes
    const text_config = parse_prefixed_generation_config(gemini_section, 'text_');
    const image_config = parse_prefixed_generation_config(gemini_section, 'image_');
    
    const provider_config: GeminiProviderConfig = {
      api_key,
      api_url: gemini_section.api_url,
      api_url_image: gemini_section.api_url_image,
      model_text_text: gemini_section.model_text_text,
      model_image_text: gemini_section.model_image_text,
      model_text_image: gemini_section.model_text_image,
      model_image_image: gemini_section.model_image_image,
      model_document_text: gemini_section.model_document_text,
      text_config,
      image_config,
      capabilities: capabilities.length > 0 ? capabilities : undefined,
      logger,
    };
    
    return new GeminiProvider(provider_config);
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to load Gemini provider from config', {
      file: 'index.ts',
      line: 378,
      data: { error: error_message, config_path },
    });
    return null;
  }
}

/**
 * Parse Qwen generation config from a section with optional prefix
 * Supports prefixed configs like "text_temperature" or "image_temperature"
 * @param section - The parsed ini section object
 * @param prefix - Optional prefix to filter keys (e.g., "text_" or "image_")
 * @returns QwenGenerationConfig or undefined if no params set
 */
function parse_prefixed_qwen_generation_config(
  section: Record<string, string> | undefined,
  prefix?: string
): QwenGenerationConfig | undefined {
  if (!section) {
    return undefined;
  }
  
  const config: QwenGenerationConfig = {};
  let has_params = false;
  
  // Helper to get value with or without prefix
  const get_value = (key: string): string | undefined => {
    if (prefix) {
      return section[`${prefix}${key}`];
    }
    return section[key];
  };
  
  // Parse temperature (number)
  const temp = get_value('temperature');
  if (temp !== undefined) {
    const temp_val = parseFloat(temp);
    if (!isNaN(temp_val)) {
      config.temperature = temp_val;
      has_params = true;
    }
  }
  
  // Parse max_tokens (number)
  const max_tokens = get_value('max_tokens');
  if (max_tokens !== undefined) {
    const tokens = parseInt(max_tokens, 10);
    if (!isNaN(tokens)) {
      config.max_tokens = tokens;
      has_params = true;
    }
  }
  
  // Parse top_p (number)
  const top_p = get_value('top_p');
  if (top_p !== undefined) {
    const p = parseFloat(top_p);
    if (!isNaN(p)) {
      config.top_p = p;
      has_params = true;
    }
  }
  
  // Parse top_k (number)
  const top_k = get_value('top_k');
  if (top_k !== undefined) {
    const k = parseInt(top_k, 10);
    if (!isNaN(k)) {
      config.top_k = k;
      has_params = true;
    }
  }
  
  // Parse n (number)
  const n = get_value('n');
  if (n !== undefined) {
    const n_val = parseInt(n, 10);
    if (!isNaN(n_val)) {
      config.n = n_val;
      has_params = true;
    }
  }
  
  // Parse stop (JSON array string)
  const stop = get_value('stop');
  if (stop !== undefined) {
    try {
      const sequences = JSON.parse(stop);
      if (Array.isArray(sequences) && sequences.length > 0) {
        config.stop = sequences;
        has_params = true;
      }
    } catch {
      // Invalid JSON, skip
    }
  }
  
  // Parse presence_penalty (number)
  const presence_penalty = get_value('presence_penalty');
  if (presence_penalty !== undefined) {
    const penalty = parseFloat(presence_penalty);
    if (!isNaN(penalty)) {
      config.presence_penalty = penalty;
      has_params = true;
    }
  }
  
  // Parse frequency_penalty (number)
  const frequency_penalty = get_value('frequency_penalty');
  if (frequency_penalty !== undefined) {
    const penalty = parseFloat(frequency_penalty);
    if (!isNaN(penalty)) {
      config.frequency_penalty = penalty;
      has_params = true;
    }
  }
  
  return has_params ? config : undefined;
}

/**
 * Load and initialize Qwen provider from config
 * @param logger - Logger instance
 * @returns QwenProvider instance or null if config invalid
 */
function load_qwen_provider_from_config(logger: Logger): QwenProvider | null {
  const config_path = find_config_file();
  if (!config_path) {
    logger.warn('Config file not found, cannot load Qwen provider', {
      file: 'index.ts',
      line: 500,
    });
    return null;
  }

  try {
    const config_content = fs.readFileSync(config_path, 'utf-8');
    const config = ini.parse(config_content);
    const qwen_section = config.llm_qwen || {};

    // Support custom env var name via api_key_env config option
    const env_var_name = qwen_section.api_key_env || 'QWEN_API_KEY';
    const api_key = process.env[env_var_name];

    if (!api_key) {
      logger.error(`${env_var_name} not found in environment variables`, {
        file: 'index.ts',
        line: 512,
        data: { config_path, env_var_name },
      });
      return null;
    }
    
    // Parse capabilities
    const capabilities = parse_capabilities(qwen_section.capabilities);
    
    // Parse generation configs with prefixes
    const text_config = parse_prefixed_qwen_generation_config(qwen_section, 'text_');
    const image_config = parse_prefixed_qwen_generation_config(qwen_section, 'image_');
    
    const provider_config: QwenProviderConfig = {
      api_key,
      api_url: qwen_section.api_url,
      model_text_text: qwen_section.model_text_text,
      model_image_text: qwen_section.model_image_text,
      model_text_image: qwen_section.model_text_image,
      model_image_image: qwen_section.model_image_image,
      api_url_text_text: qwen_section.api_url_text_text,
      api_url_image_text: qwen_section.api_url_image_text,
      api_url_text_image: qwen_section.api_url_text_image,
      api_url_image_image: qwen_section.api_url_image_image,
      system_instruction: qwen_section.system_instruction,
      text_config,
      image_config,
      capabilities: capabilities.length > 0 ? capabilities : undefined,
      logger,
    };
    
    return new QwenProvider(provider_config);
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to load Qwen provider from config', {
      file: 'index.ts',
      line: 543,
      data: { error: error_message, config_path },
    });
    return null;
  }
}

/**
 * Load and register all enabled providers from config file
 * @param logger - Logger instance
 */
function load_and_register_providers(logger: Logger): void {
  const global_config = get_llm_global_config();
  
  // Set enabled LLMs and primary LLM in registry
  set_enabled_llms(global_config.enabled_llms);
  set_primary_llm(global_config.primary_llm);
  
  logger.info('Loading LLM providers from config', {
    file: 'index.ts',
    line: 395,
    data: {
      enabled_llms: global_config.enabled_llms,
      primary_llm: global_config.primary_llm,
    },
  });
  
  // Load each enabled provider
  for (const llm_name of global_config.enabled_llms) {
    if (llm_name.toLowerCase() === 'gemini') {
      const provider = load_gemini_provider_from_config(logger);
      if (provider) {
        register_provider(provider);
        logger.info('Registered Gemini provider', {
          file: 'index.ts',
          line: 636,
          data: {
            capabilities: Array.from(provider.get_capabilities()),
          },
        });
      } else {
        logger.warn('Gemini provider is enabled in config but failed to load. Check GEMINI_API_KEY in environment variables.', {
          file: 'index.ts',
          line: 716,
          data: { llm_name: llm_name.toLowerCase() },
        });
      }
    } else if (llm_name.toLowerCase() === 'qwen') {
      const provider = load_qwen_provider_from_config(logger);
      if (provider) {
        register_provider(provider);
        logger.info('Registered Qwen provider', {
          file: 'index.ts',
          line: 646,
          data: {
            capabilities: Array.from(provider.get_capabilities()),
          },
        });
      } else {
        logger.warn('Qwen provider is enabled in config but failed to load. Check QWEN_API_KEY in environment variables.', {
          file: 'index.ts',
          line: 728,
          data: { llm_name: llm_name.toLowerCase() },
        });
      }
    }
    // Future: Add other providers here (OpenAI, Anthropic, etc.)
  }
}

// =============================================================================
// Auto-initialization on Import
// =============================================================================

/**
 * Auto-initialize database when module is imported
 * Uses config file defaults, does not require API key
 */
async function auto_initialize_database(): Promise<void> {
  if (db_auto_initialized) {
    return;
  }
  
  const file_name = 'index.ts (llm_api)';
  
  try {
    const sqlite_path = get_sqlite_path_from_config();
    
    default_logger.info('Auto-initializing database on module import', {
      file: file_name,
      line: 110,
      data: { sqlite_path },
    });
    
    await initialize_database(sqlite_path, default_logger);
    db_auto_initialized = true;
    
    default_logger.info('Database auto-initialized successfully', {
      file: file_name,
      line: 118,
      data: { sqlite_path },
    });
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    default_logger.error('Failed to auto-initialize database', {
      file: file_name,
      line: 124,
      data: { error: error_message },
    });
    // Don't throw - allow manual initialization later
  }
}

// Trigger auto-initialization when module is imported
// Using void to handle the promise without blocking
void auto_initialize_database();

// =============================================================================
// Initialization Function
// =============================================================================

/**
 * Initialize the LLM API with the given configuration
 * Creates/connects to the database and prepares the client for use
 *
 * @param config - Configuration options for the LLM API (all fields optional)
 * @returns Initialized LLM API client
 *
 * @example
 * ```typescript
 * // Minimal initialization (uses defaults)
 * const api = await initialize_llm_api({});
 *
 * // With custom logger
 * const api = await initialize_llm_api({ logger: myLogger });
 *
 * // With custom database path
 * const api = await initialize_llm_api({ sqlite_path: '~/data/prompts.db' });
 * ```
 */
export async function initialize_llm_api(config: LLMApiConfig = {}): Promise<LLMApiClient> {
  const file_name = 'index.ts (llm_api)';

  // Use provided logger or default
  const logger = config.logger || default_logger;

  // Store the logger for use by other functions
  set_logger(logger);

  // Store hooks if provided
  if (config.hooks) {
    set_hooks(config.hooks);
  }

  // Get global config from file
  const global_config = get_llm_global_config();

  // Use provided sqlite_path or fall back to config file value
  const sqlite_path = config.sqlite_path || global_config.sqlite_path;

  // Load and register providers from config file
  load_and_register_providers(logger);

  // Validate that primary_llm is enabled
  const primary_llm_name = get_primary_llm();
  if (!primary_llm_name) {
    const error_msg = 'No primary LLM configured. Set primary_llm in [llm] section of config file.';
    logger.error(error_msg, {
      file: file_name,
      line: 615,
    });
    throw new Error(error_msg);
  }

  logger.info('Initializing LLM API', {
    file: file_name,
    line: 620,
    data: {
      sqlite_path,
      enabled_llms: global_config.enabled_llms,
      primary_llm: primary_llm_name,
    },
  });

  // Set final config
  const final_config: LLMApiConfig = {
    logger,
    sqlite_path,
    hooks: config.hooks,
  };

  // Initialize the database (async)
  try {
    await initialize_database(sqlite_path, logger);
    initialized = true;
    current_config = final_config;

    logger.info('LLM API initialized successfully', {
      file: file_name,
      line: 645,
      data: {
        primary_llm: primary_llm_name,
        registered_providers: get_registered_providers(),
      },
    });
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to initialize LLM API', {
      file: file_name,
      line: 653,
      data: { error: error_message },
    });
    throw error;
  }
  
  // Create and return the client instance
  const client: LLMApiClient = {
    config: final_config,
    db_initialized: initialized,
    hazo_llm_text_text: async (params: TextTextParams, llm?: ProviderName): Promise<LLMResponse> => {
      return hazo_llm_text_text(params, llm);
    },
    hazo_llm_image_text: async (params: ImageTextParams, llm?: ProviderName): Promise<LLMResponse> => {
      return hazo_llm_image_text(params, llm);
    },
    hazo_llm_text_image: async (params: TextImageParams, llm?: ProviderName): Promise<LLMResponse> => {
      return hazo_llm_text_image(params, llm);
    },
    hazo_llm_image_image: async (params: ImageImageParams, llm?: ProviderName): Promise<LLMResponse> => {
      return hazo_llm_image_image(params, llm);
    },
    hazo_llm_text_image_text: async (params: TextImageTextParams, llm?: ProviderName): Promise<LLMResponse> => {
      return hazo_llm_text_image_text(params, llm);
    },
    hazo_llm_image_image_text: async (params: ImageImageTextParams, llm?: ProviderName): Promise<LLMResponse> => {
      return hazo_llm_image_image_text(params, llm);
    },
    hazo_llm_document_text: async (params: DocumentTextParams, llm?: ProviderName): Promise<LLMResponse> => {
      return hazo_llm_document_text(params, llm);
    },
    hazo_llm_prompt_chain: async (params: PromptChainParams, llm?: ProviderName): Promise<PromptChainResponse> => {
      return hazo_llm_prompt_chain(params, llm);
    },
  };

  return client;
}

// =============================================================================
// Module Level Functions
// =============================================================================

/**
 * Helper to check full LLM API initialization (required for LLM calls)
 * Ensures logger is always present in returned config
 */
function check_initialized(): LLMApiConfig & { logger: Logger } {
  if (!initialized || !current_config) {
    throw new Error('LLM API not initialized. Call initialize_llm_api first.');
  }
  // Ensure logger is always present
  return {
    ...current_config,
    logger: current_config.logger || get_logger(),
  };
}

/**
 * Check if database has been initialized (either auto or manual)
 * @returns true if database is ready for use
 */
export function is_database_ready(): boolean {
  return db_auto_initialized || initialized;
}

/**
 * Wait for auto-initialization to complete
 * Useful if you need to ensure database is ready before operations
 */
export async function ensure_database_ready(): Promise<boolean> {
  if (db_auto_initialized || initialized) {
    return true;
  }
  
  // If not yet initialized, trigger it now
  await auto_initialize_database();
  return db_auto_initialized;
}

/**
 * Text input → Text output
 * Standard text generation using LLM
 *
 * @param params - Text input parameters
 * @param llm - Optional LLM provider name (uses primary LLM if not specified). Use LLM_PROVIDERS constants for type safety.
 * @returns LLM response with generated text
 *
 * @example
 * ```typescript
 * import { hazo_llm_text_text, LLM_PROVIDERS } from 'hazo_llm_api/server';
 *
 * const response = await hazo_llm_text_text({ prompt: 'Hello' }, LLM_PROVIDERS.GEMINI);
 * ```
 */
export async function hazo_llm_text_text(params: TextTextParams, llm?: ProviderName): Promise<LLMResponse> {
  try {
    const config = check_initialized();
    const db = get_database();
    return hazo_llm_text_text_internal(params, db, config, llm);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Image input → Text output
 * Analyze an image and get text description
 *
 * @param params - Image input parameters
 * @param llm - Optional LLM provider name (uses primary LLM if not specified). Use LLM_PROVIDERS constants for type safety.
 * @returns LLM response with text description
 */
export async function hazo_llm_image_text(params: ImageTextParams, llm?: ProviderName): Promise<LLMResponse> {
  try {
    const config = check_initialized();
    const db = get_database();
    return hazo_llm_image_text_internal(params, db, config, llm);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Text input → Image output
 * Generate an image from text description
 *
 * @param params - Text input parameters for image generation
 * @param llm - Optional LLM provider name (uses primary LLM if not specified). Use LLM_PROVIDERS constants for type safety.
 * @returns LLM response with generated image
 */
export async function hazo_llm_text_image(params: TextImageParams, llm?: ProviderName): Promise<LLMResponse> {
  try {
    const config = check_initialized();
    const db = get_database();
    return hazo_llm_text_image_internal(params, db, config, llm);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Image input → Image output
 * Transform/edit an image based on instructions
 *
 * @param params - Image input parameters with transformation instructions
 * @param llm - Optional LLM provider name (uses primary LLM if not specified). Use LLM_PROVIDERS constants for type safety.
 * @returns LLM response with transformed image
 */
export async function hazo_llm_image_image(params: ImageImageParams, llm?: ProviderName): Promise<LLMResponse> {
  try {
    const config = check_initialized();
    const db = get_database();
    return hazo_llm_image_image_internal(params, db, config, llm);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Text → Image → Text (Chained)
 * Generate an image from prompt_image, then analyze it with prompt_text
 *
 * @param params - Parameters with two prompts: one for image gen, one for analysis
 * @param llm - Optional LLM provider name (uses primary LLM if not specified). Use LLM_PROVIDERS constants for type safety.
 * @returns LLM response with generated image and analysis text
 */
export async function hazo_llm_text_image_text(params: TextImageTextParams, llm?: ProviderName): Promise<LLMResponse> {
  try {
    const config = check_initialized();
    const db = get_database();
    return hazo_llm_text_image_text_internal(params, db, config, llm);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Images → Image → Text (Chained)
 * Chain multiple image transformations, then describe the final result
 *
 * @param params - Parameters with images, prompts, and description prompt
 * @param llm - Optional LLM provider name (uses primary LLM if not specified). Use LLM_PROVIDERS constants for type safety.
 * @returns LLM response with final image and description text
 */
export async function hazo_llm_image_image_text(params: ImageImageTextParams, llm?: ProviderName): Promise<LLMResponse> {
  try {
    const config = check_initialized();
    const db = get_database();
    return hazo_llm_image_image_text_internal(params, db, config, llm);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Document input → Text output
 * Analyze a document (PDF) and get text analysis/description
 *
 * @param params - Document input parameters
 * @param llm - Optional LLM provider name (uses primary LLM if not specified). Use LLM_PROVIDERS constants for type safety.
 * @returns LLM response with text analysis
 *
 * @example
 * ```typescript
 * import { hazo_llm_document_text, LLM_PROVIDERS } from 'hazo_llm_api/server';
 *
 * const response = await hazo_llm_document_text({
 *   prompt: 'Summarize this document',
 *   document_b64: base64EncodedPdf,
 *   document_mime_type: 'application/pdf',
 * }, LLM_PROVIDERS.GEMINI);
 * ```
 */
export async function hazo_llm_document_text(params: DocumentTextParams, llm?: ProviderName): Promise<LLMResponse> {
  try {
    const config = check_initialized();
    const db = get_database();
    return hazo_llm_document_text_internal(params, db, config, llm);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Execute a chain of prompts with dynamic value resolution
 * Each call can reference values from previous call results
 *
 * @param params - Chain parameters including call definitions
 * @param llm - Optional LLM provider name (uses primary LLM if not specified). Use LLM_PROVIDERS constants for type safety.
 * @returns Chain response with merged results and individual call outcomes
 *
 * @example
 * ```typescript
 * import { hazo_llm_prompt_chain } from 'hazo_llm_api/server';
 *
 * const response = await hazo_llm_prompt_chain({
 *   chain_calls: [
 *     {
 *       prompt_area: { match_type: 'direct', value: 'document' },
 *       prompt_key: { match_type: 'direct', value: 'initial_read' }
 *     },
 *     {
 *       prompt_area: { match_type: 'direct', value: 'document' },
 *       prompt_key: { match_type: 'direct', value: 'process_results' },
 *       local_1: {
 *         match_type: 'call_chain',
 *         value: 'call[0].tax_category',
 *         variable_name: 'previous_category'
 *       }
 *     }
 *   ]
 * });
 * ```
 */
export async function hazo_llm_prompt_chain(params: PromptChainParams, llm?: ProviderName): Promise<PromptChainResponse> {
  try {
    const config = check_initialized();
    const db = get_database();
    return hazo_llm_prompt_chain_internal(params, db, config, llm);
  } catch (error) {
    return {
      success: false,
      merged_result: {},
      call_results: [],
      errors: [{ call_index: -1, error: error instanceof Error ? error.message : String(error) }],
      total_calls: params.chain_calls.length,
      successful_calls: 0,
    };
  }
}

// =============================================================================
// Streaming Functions
// =============================================================================

/**
 * Text input → Text output (Streaming)
 * Generate text from a prompt with streaming response
 *
 * @param params - Text input parameters
 * @param llm - Optional LLM provider name (uses primary LLM if not specified)
 * @returns Async generator yielding text chunks
 *
 * @example
 * ```typescript
 * const stream = await hazo_llm_text_text_stream({ prompt: 'Tell me a story' });
 *
 * for await (const chunk of stream) {
 *   if (chunk.error) {
 *     console.error(chunk.error);
 *     break;
 *   }
 *   process.stdout.write(chunk.text);
 *   if (chunk.done) break;
 * }
 * ```
 */
export async function* hazo_llm_text_text_stream(
  params: TextTextParams,
  llm?: ProviderName
): LLMStreamResponse {
  try {
    const config = check_initialized();
    const logger = config.logger || get_logger();

    // Get provider
    const provider = get_provider(llm, logger);
    if (!provider) {
      yield {
        text: '',
        done: true,
        error: `Provider "${llm || 'primary'}" not found`,
        error_info: {
          code: LLM_ERROR_CODES.PROVIDER_NOT_FOUND,
          message: `Provider "${llm || 'primary'}" not found`,
          retryable: false,
        },
      };
      return;
    }

    // Check if provider supports streaming
    if (!provider.text_text_stream) {
      yield {
        text: '',
        done: true,
        error: `Provider "${provider.get_name()}" does not support streaming`,
        error_info: {
          code: LLM_ERROR_CODES.CAPABILITY_NOT_SUPPORTED,
          message: `Provider "${provider.get_name()}" does not support streaming for text_text`,
          retryable: false,
        },
      };
      return;
    }

    // Call streaming method
    const stream = await provider.text_text_stream(params, logger);
    yield* stream;
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    yield {
      text: '',
      done: true,
      error: error_message,
      error_info: {
        code: LLM_ERROR_CODES.UNKNOWN,
        message: error_message,
        retryable: false,
      },
    };
  }
}

/**
 * Image input → Text output (Streaming)
 * Analyze an image and stream text description
 *
 * @param params - Image input parameters
 * @param llm - Optional LLM provider name (uses primary LLM if not specified)
 * @returns Async generator yielding text chunks
 */
export async function* hazo_llm_image_text_stream(
  params: ImageTextParams,
  llm?: ProviderName
): LLMStreamResponse {
  try {
    const config = check_initialized();
    const logger = config.logger || get_logger();

    // Get provider
    const provider = get_provider(llm, logger);
    if (!provider) {
      yield {
        text: '',
        done: true,
        error: `Provider "${llm || 'primary'}" not found`,
        error_info: {
          code: LLM_ERROR_CODES.PROVIDER_NOT_FOUND,
          message: `Provider "${llm || 'primary'}" not found`,
          retryable: false,
        },
      };
      return;
    }

    // Check if provider supports streaming
    if (!provider.image_text_stream) {
      yield {
        text: '',
        done: true,
        error: `Provider "${provider.get_name()}" does not support streaming`,
        error_info: {
          code: LLM_ERROR_CODES.CAPABILITY_NOT_SUPPORTED,
          message: `Provider "${provider.get_name()}" does not support streaming for image_text`,
          retryable: false,
        },
      };
      return;
    }

    // Call streaming method
    const stream = await provider.image_text_stream(params, logger);
    yield* stream;
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    yield {
      text: '',
      done: true,
      error: error_message,
      error_info: {
        code: LLM_ERROR_CODES.UNKNOWN,
        message: error_message,
        retryable: false,
      },
    };
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if the LLM API has been initialized
 * @returns true if initialized
 */
export function is_initialized(): boolean {
  return initialized;
}

/**
 * Get the current configuration (without sensitive logger)
 * @returns Current configuration or null if not initialized
 */
export function get_current_config(): Omit<LLMApiConfig, 'logger'> | null {
  if (!current_config) {
    return null;
  }

  return {
    sqlite_path: current_config.sqlite_path,
    hooks: current_config.hooks,
  };
}

// =============================================================================
// Re-exports
// =============================================================================

export type {
  LLMApiConfig,
  LLMApiClient,
  LLMResponse,
  TextTextParams,
  ImageTextParams,
  TextImageParams,
  ImageImageParams,
  DocumentTextParams,
  TextImageTextParams,
  ImageImageTextParams,
  ChainImage,
  Logger,
  PromptVariable,
  PromptVariables,
  Base64Data,
  PromptTextMode,
  PromptRecord,
  CallLLMParams,
  GeminiGenerationConfig,
  GeminiApiGenerationConfig,
  // Prompt Chain Types
  ChainMatchType,
  ChainFieldDefinition,
  ChainCallDefinition,
  ChainCallResult,
  PromptChainParams,
  PromptChainResponse,
} from './types.js';

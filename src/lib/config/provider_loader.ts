/**
 * Provider Loader Factory
 *
 * Generic factory for loading LLM providers from configuration.
 * Reduces duplication by providing a unified approach to provider loading.
 */

import type { LLMProvider, ServiceType } from '../providers/types.js';
import type { Logger } from '../llm_api/types.js';
import {
  find_config_file,
  read_config_file,
  parse_generation_config,
  parse_capabilities,
  load_api_key_from_env,
  get_api_key_env_var_name,
  type ParameterMapping,
} from './config_parser.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Base configuration that all providers share
 */
export interface BaseProviderConfig {
  api_key: string;
  api_url?: string;
  capabilities?: ServiceType[];
  logger: Logger;
}

/**
 * Provider factory definition
 * Used to register how to load a specific provider type
 */
export interface ProviderFactory<TConfig extends BaseProviderConfig> {
  /** Provider name (lowercase) */
  name: string;

  /** INI section name (e.g., "llm_gemini") */
  config_section: string;

  /** Parameter mappings for text generation config */
  text_param_mappings: ParameterMapping[];

  /** Parameter mappings for image generation config */
  image_param_mappings: ParameterMapping[];

  /**
   * Build provider-specific config from INI section
   *
   * @param section - The parsed INI section
   * @param api_key - The API key loaded from environment
   * @param text_config - Parsed text generation config
   * @param image_config - Parsed image generation config
   * @param capabilities - Parsed capabilities
   * @param logger - Logger instance
   * @returns Provider-specific config object
   */
  build_config(
    section: Record<string, string>,
    api_key: string,
    text_config: unknown,
    image_config: unknown,
    capabilities: ServiceType[],
    logger: Logger
  ): TConfig;

  /**
   * Create provider instance from config
   *
   * @param config - Provider-specific config object
   * @returns Provider instance
   */
  create_provider(config: TConfig): LLMProvider;
}

/**
 * Result of loading a provider
 */
export type ProviderLoadResult =
  | { success: true; provider: LLMProvider }
  | { success: false; error: string };

// =============================================================================
// Provider Registry
// =============================================================================

/**
 * Map of registered provider factories by name
 */
const provider_factories = new Map<string, ProviderFactory<BaseProviderConfig>>();

/**
 * Register a provider factory
 *
 * @param factory - Provider factory to register
 *
 * @example
 * ```typescript
 * register_provider_factory({
 *   name: 'gemini',
 *   config_section: 'llm_gemini',
 *   text_param_mappings: GEMINI_PARAM_MAPPINGS,
 *   image_param_mappings: GEMINI_PARAM_MAPPINGS,
 *   build_config: (section, api_key, text_config, image_config, capabilities, logger) => ({
 *     api_key,
 *     api_url: section.api_url,
 *     // ... other gemini-specific fields
 *   }),
 *   create_provider: (config) => new GeminiProvider(config),
 * });
 * ```
 */
export function register_provider_factory<TConfig extends BaseProviderConfig>(
  factory: ProviderFactory<TConfig>
): void {
  provider_factories.set(
    factory.name.toLowerCase(),
    factory as unknown as ProviderFactory<BaseProviderConfig>
  );
}

/**
 * Get a registered provider factory by name
 *
 * @param name - Provider name (case-insensitive)
 * @returns Provider factory or undefined
 */
export function get_provider_factory(
  name: string
): ProviderFactory<BaseProviderConfig> | undefined {
  return provider_factories.get(name.toLowerCase());
}

/**
 * Get all registered provider factory names
 *
 * @returns Array of provider names
 */
export function get_registered_factory_names(): string[] {
  return Array.from(provider_factories.keys());
}

// =============================================================================
// Provider Loading
// =============================================================================

/**
 * Load a provider from config using its registered factory
 *
 * @param provider_name - Name of the provider to load
 * @param logger - Logger instance
 * @returns Provider instance or error result
 */
export function load_provider_from_config(
  provider_name: string,
  logger: Logger
): ProviderLoadResult {
  const file_name = 'provider_loader.ts';
  const name_lower = provider_name.toLowerCase();

  // Get the factory for this provider
  const factory = provider_factories.get(name_lower);
  if (!factory) {
    return {
      success: false,
      error: `No factory registered for provider "${provider_name}". Available: ${get_registered_factory_names().join(', ')}`,
    };
  }

  // Find and read config file
  const config_path = find_config_file();
  if (!config_path) {
    logger.warn('Config file not found', {
      file: file_name,
      data: { provider: provider_name },
    });
    return {
      success: false,
      error: 'Config file config/hazo_llm_api_config.ini not found',
    };
  }

  const config = read_config_file(config_path);
  if (!config) {
    return {
      success: false,
      error: `Failed to read config file: ${config_path}`,
    };
  }

  // Get the provider's section
  const section = config[factory.config_section] || {};

  // Load API key from environment
  const api_key = load_api_key_from_env(name_lower);
  if (!api_key) {
    const env_var = get_api_key_env_var_name(name_lower);
    logger.error(`${env_var} not found in environment variables`, {
      file: file_name,
      data: { provider: provider_name, config_path },
    });
    return {
      success: false,
      error: `${env_var} not found in environment variables. Add it to your .env.local file.`,
    };
  }

  try {
    // Parse generation configs
    const text_config = parse_generation_config(
      section,
      factory.text_param_mappings,
      'text_'
    );
    const image_config = parse_generation_config(
      section,
      factory.image_param_mappings,
      'image_'
    );

    // Parse capabilities
    const capabilities = parse_capabilities(section.capabilities);

    // Build provider config
    const provider_config = factory.build_config(
      section,
      api_key,
      text_config,
      image_config,
      capabilities,
      logger
    );

    // Create provider instance
    const provider = factory.create_provider(provider_config);

    logger.info(`Loaded ${provider_name} provider`, {
      file: file_name,
      data: {
        capabilities: Array.from(provider.get_capabilities()),
      },
    });

    return { success: true, provider };
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to load ${provider_name} provider`, {
      file: file_name,
      data: { error: error_message, config_path },
    });
    return {
      success: false,
      error: `Failed to create ${provider_name} provider: ${error_message}`,
    };
  }
}

/**
 * Load all enabled providers from config
 *
 * @param enabled_llms - List of enabled LLM names
 * @param logger - Logger instance
 * @returns Map of successfully loaded providers
 */
export function load_all_providers(
  enabled_llms: string[],
  logger: Logger
): Map<string, LLMProvider> {
  const file_name = 'provider_loader.ts';
  const providers = new Map<string, LLMProvider>();

  for (const llm_name of enabled_llms) {
    const result = load_provider_from_config(llm_name, logger);

    if (result.success) {
      providers.set(llm_name.toLowerCase(), result.provider);
    } else {
      logger.warn(`${llm_name} provider is enabled but failed to load`, {
        file: file_name,
        data: {
          llm_name,
          error: result.error,
          hint: `Check ${get_api_key_env_var_name(llm_name)} in environment variables and [llm_${llm_name.toLowerCase()}] section in config.`,
        },
      });
    }
  }

  return providers;
}

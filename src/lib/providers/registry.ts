/**
 * LLM Provider Registry
 * 
 * Central registry for managing and accessing LLM providers.
 * Handles provider registration, capability validation, and enabled LLM tracking.
 */

import type {
  LLMProvider,
  LLMCapabilities,
  ServiceType,
  LLMProviderConfig,
} from './types.js';
import type { Logger } from '../llm_api/types.js';

// =============================================================================
// Provider Registry
// =============================================================================

/**
 * Map of registered providers by name
 */
const provider_map = new Map<string, LLMProvider>();

/**
 * Set of enabled LLM provider names
 */
let enabled_llms = new Set<string>();

/**
 * Primary/default LLM provider name
 */
let primary_llm: string | null = null;

// =============================================================================
// Registry Management
// =============================================================================

/**
 * Register a provider in the registry
 * @param provider - The provider instance to register
 */
export function register_provider(provider: LLMProvider): void {
  const name = provider.get_name().toLowerCase();
  provider_map.set(name, provider);
}

/**
 * Set which LLMs are enabled
 * @param enabled_names - Array of LLM names that are enabled
 */
export function set_enabled_llms(enabled_names: string[]): void {
  enabled_llms = new Set(enabled_names.map(name => name.toLowerCase()));
}

/**
 * Set the primary/default LLM
 * @param name - Name of the primary LLM
 */
export function set_primary_llm(name: string): void {
  primary_llm = name.toLowerCase();
}

/**
 * Get the primary/default LLM name
 * @returns Primary LLM name or null if not set
 */
export function get_primary_llm(): string | null {
  return primary_llm;
}

/**
 * Check if an LLM is enabled
 * @param name - LLM name to check
 * @returns True if the LLM is enabled
 */
export function is_llm_enabled(name: string): boolean {
  return enabled_llms.has(name.toLowerCase());
}

/**
 * Get a provider by name
 * @param name - Provider name (case-insensitive)
 * @param logger - Logger instance for error logging
 * @returns Provider instance or null if not found
 */
export function get_provider(
  name: string | null | undefined,
  logger: Logger
): LLMProvider | null {
  // Use primary LLM if name not specified
  const provider_name = (name || primary_llm || '').toLowerCase();
  
  if (!provider_name) {
    logger.error('No LLM provider specified and no primary LLM configured', {
      file: 'registry.ts',
      line: 88,
      data: { requested_name: name, primary_llm },
    });
    return null;
  }
  
  // Check if LLM is enabled
  if (!is_llm_enabled(provider_name)) {
    logger.error('Requested LLM is not enabled', {
      file: 'registry.ts',
      line: 96,
      data: {
        requested_llm: provider_name,
        enabled_llms: Array.from(enabled_llms),
      },
    });
    return null;
  }
  
  // Get provider
  const provider = provider_map.get(provider_name);
  
  if (!provider) {
    // Provider is enabled but not registered - likely missing API key or config issue
    const env_var_name = `${provider_name.toUpperCase()}_API_KEY`;
    logger.error('LLM provider is enabled but not registered', {
      file: 'registry.ts',
      line: 108,
      data: {
        requested_llm: provider_name,
        available_providers: Array.from(provider_map.keys()),
        enabled_llms: Array.from(enabled_llms),
        hint: `Provider "${provider_name}" is enabled in config but not loaded. Check ${env_var_name} in environment variables and provider configuration.`,
      },
    });
    return null;
  }
  
  return provider;
}

/**
 * Check if a provider supports a specific service type
 * @param provider - Provider instance
 * @param service_type - Service type to check
 * @returns True if the provider supports the service
 */
export function has_capability(
  provider: LLMProvider,
  service_type: ServiceType
): boolean {
  const capabilities = provider.get_capabilities();
  return capabilities.has(service_type);
}

/**
 * Validate that a provider supports a service before calling it
 * @param provider - Provider instance
 * @param service_type - Service type to validate
 * @param logger - Logger instance
 * @returns True if capability is supported, false otherwise
 */
export function validate_capability(
  provider: LLMProvider,
  service_type: ServiceType,
  logger: Logger
): boolean {
  if (!has_capability(provider, service_type)) {
    const provider_name = provider.get_name();
    logger.error('Provider does not support requested service', {
      file: 'registry.ts',
      line: 142,
      data: {
        provider: provider_name,
        service_type,
        supported_capabilities: Array.from(provider.get_capabilities()),
      },
    });
    return false;
  }
  
  return true;
}

/**
 * Get all registered provider names
 * @returns Array of provider names
 */
export function get_registered_providers(): string[] {
  return Array.from(provider_map.keys());
}

/**
 * Clear all registered providers (useful for testing)
 */
export function clear_registry(): void {
  provider_map.clear();
  enabled_llms.clear();
  primary_llm = null;
}


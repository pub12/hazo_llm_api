/**
 * Prompt Cache Module
 *
 * Simple LRU cache for frequently accessed prompts.
 * Reduces database queries for repeated prompt lookups.
 */

import type { PromptRecord } from '../llm_api/types.js';

// =============================================================================
// Cache Configuration
// =============================================================================

/** Default cache TTL in milliseconds (5 minutes) */
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

/** Default maximum cache size */
const DEFAULT_MAX_CACHE_SIZE = 100;

// =============================================================================
// Types
// =============================================================================

/**
 * Cached prompt entry with metadata
 */
interface CacheEntry {
  prompt: PromptRecord;
  timestamp: number;
  access_count: number;
}

/**
 * Cache configuration options
 */
export interface PromptCacheConfig {
  /** Time-to-live in milliseconds (default: 5 minutes) */
  ttl_ms?: number;
  /** Maximum number of entries (default: 100) */
  max_size?: number;
  /** Whether caching is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  max_size: number;
  hit_rate: number;
}

// =============================================================================
// Prompt Cache Implementation
// =============================================================================

/**
 * Simple LRU cache for prompts
 *
 * @example
 * ```typescript
 * const cache = new PromptCache({ ttl_ms: 60000, max_size: 50 });
 *
 * // Check cache first
 * const cached = cache.get('marketing', 'greeting');
 * if (cached) {
 *   return cached;
 * }
 *
 * // Fetch from database and cache
 * const prompt = get_prompt_by_area_and_key(db, 'marketing', 'greeting', logger);
 * if (prompt) {
 *   cache.set(prompt);
 * }
 * ```
 */
export class PromptCache {
  private cache: Map<string, CacheEntry>;
  private ttl_ms: number;
  private max_size: number;
  private enabled: boolean;
  private hits: number;
  private misses: number;

  constructor(config: PromptCacheConfig = {}) {
    this.cache = new Map();
    this.ttl_ms = config.ttl_ms ?? DEFAULT_CACHE_TTL_MS;
    this.max_size = config.max_size ?? DEFAULT_MAX_CACHE_SIZE;
    this.enabled = config.enabled ?? true;
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Generate cache key from area and key
   */
  private make_key(area: string, key: string): string {
    return `${area}:${key}`;
  }

  /**
   * Check if an entry is expired
   */
  private is_expired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > this.ttl_ms;
  }

  /**
   * Evict least recently used entries if cache is full
   */
  private evict_if_needed(): void {
    if (this.cache.size < this.max_size) {
      return;
    }

    // Find entry with oldest timestamp
    let oldest_key: string | null = null;
    let oldest_time = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldest_time) {
        oldest_time = entry.timestamp;
        oldest_key = key;
      }
    }

    if (oldest_key) {
      this.cache.delete(oldest_key);
    }
  }

  /**
   * Get a prompt from the cache
   *
   * @param area - Prompt area
   * @param key - Prompt key
   * @returns Cached prompt or null if not found/expired
   */
  get(area: string, key: string): PromptRecord | null {
    if (!this.enabled) {
      return null;
    }

    const cache_key = this.make_key(area, key);
    const entry = this.cache.get(cache_key);

    if (!entry) {
      this.misses++;
      return null;
    }

    if (this.is_expired(entry)) {
      this.cache.delete(cache_key);
      this.misses++;
      return null;
    }

    // Update access metadata
    entry.access_count++;
    entry.timestamp = Date.now();
    this.hits++;

    return entry.prompt;
  }

  /**
   * Get a prompt by ID from the cache
   *
   * @param id - Prompt ID (UUID)
   * @returns Cached prompt or null if not found/expired
   */
  get_by_id(id: string): PromptRecord | null {
    if (!this.enabled) {
      return null;
    }

    // Linear search through cache (ID lookups are less common)
    for (const entry of this.cache.values()) {
      if (entry.prompt.id === id) {
        if (this.is_expired(entry)) {
          // Let the area:key lookup handle deletion
          this.misses++;
          return null;
        }
        entry.access_count++;
        entry.timestamp = Date.now();
        this.hits++;
        return entry.prompt;
      }
    }

    this.misses++;
    return null;
  }

  /**
   * Add a prompt to the cache
   *
   * @param prompt - Prompt record to cache
   */
  set(prompt: PromptRecord): void {
    if (!this.enabled) {
      return;
    }

    this.evict_if_needed();

    const cache_key = this.make_key(prompt.prompt_area, prompt.prompt_key);
    this.cache.set(cache_key, {
      prompt,
      timestamp: Date.now(),
      access_count: 1,
    });
  }

  /**
   * Remove a prompt from the cache
   *
   * @param area - Prompt area
   * @param key - Prompt key
   */
  invalidate(area: string, key: string): void {
    const cache_key = this.make_key(area, key);
    this.cache.delete(cache_key);
  }

  /**
   * Remove a prompt by ID from the cache
   *
   * @param id - Prompt ID (UUID)
   */
  invalidate_by_id(id: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.prompt.id === id) {
        this.cache.delete(key);
        break;
      }
    }
  }

  /**
   * Invalidate all prompts in an area
   *
   * @param area - Prompt area to invalidate
   */
  invalidate_area(area: string): void {
    const prefix = `${area}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Remove all expired entries
   *
   * @returns Number of entries removed
   */
  cleanup(): number {
    let removed = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (this.is_expired(entry)) {
        this.cache.delete(key);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Get cache statistics
   */
  get_stats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      max_size: this.max_size,
      hit_rate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * Enable or disable the cache
   *
   * @param enabled - Whether to enable caching
   */
  set_enabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }

  /**
   * Check if caching is enabled
   */
  is_enabled(): boolean {
    return this.enabled;
  }
}

// =============================================================================
// Global Cache Instance
// =============================================================================

/**
 * Global prompt cache instance
 * Can be configured via configure_prompt_cache()
 */
let global_cache: PromptCache | null = null;

/**
 * Get the global prompt cache instance
 * Creates one with default settings if not configured
 *
 * @returns Global prompt cache
 */
export function get_prompt_cache(): PromptCache {
  if (!global_cache) {
    global_cache = new PromptCache();
  }
  return global_cache;
}

/**
 * Configure the global prompt cache
 *
 * @param config - Cache configuration options
 */
export function configure_prompt_cache(config: PromptCacheConfig): void {
  global_cache = new PromptCache(config);
}

/**
 * Clear the global prompt cache
 */
export function clear_prompt_cache(): void {
  if (global_cache) {
    global_cache.clear();
  }
}

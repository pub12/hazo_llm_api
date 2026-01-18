/**
 * Centralized Logger for Test App
 *
 * Creates a single Winston logger instance that can be shared across
 * all API routes and components. Uses dependency injection pattern
 * to ensure consistent logging to a single file.
 *
 * Usage:
 * ```typescript
 * import { logger } from '@/lib/logger';
 *
 * logger.info('Message', { key: 'value' });
 * logger.debug('Debug message');
 * logger.error('Error occurred', { error: err.message });
 * ```
 */

import { create_hazo_logger, parse_logging_config } from 'hazo_llm_api/server';
import type { Logger } from 'hazo_llm_api';
import path from 'path';

/**
 * Path to the logging configuration file
 */
const CONFIG_PATH = path.resolve(process.cwd(), 'config', 'hazo_logs_config.ini');

/**
 * Singleton logger instance
 * Initialized lazily on first access
 */
let _logger: Logger | null = null;

/**
 * Get or create the centralized logger instance
 *
 * @returns Logger instance
 */
function get_logger(): Logger {
  if (!_logger) {
    try {
      const config = parse_logging_config(CONFIG_PATH);
      _logger = create_hazo_logger(config);
      _logger.info('Logger initialized', { config_path: CONFIG_PATH });
    } catch (error) {
      // Fallback to console logger if config parsing fails
      console.error('Failed to initialize hazo_logger, using console fallback:', error);
      _logger = {
        error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta || ''),
        info: (msg, meta) => console.log(`[INFO] ${msg}`, meta || ''),
        warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta || ''),
        debug: (msg, meta) => console.debug(`[DEBUG] ${msg}`, meta || ''),
      };
    }
  }
  return _logger;
}

/**
 * Centralized logger instance for the test app
 *
 * All API routes and components should import and use this logger
 * to ensure consistent logging to a single file.
 */
export const logger = get_logger();

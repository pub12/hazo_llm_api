/**
 * hazo_logs Module
 *
 * File-based logging with Winston for hazo_llm_api.
 * Uses dependency injection pattern - the consuming app creates and provides
 * the logger instance to ensure a single log file is used across the application.
 *
 * Usage:
 * ```typescript
 * import { create_hazo_logger, parse_logging_config } from 'hazo_llm_api/server';
 *
 * // Parse config from INI file
 * const config = parse_logging_config('./config/hazo_logs_config.ini');
 *
 * // Create logger instance
 * const logger = create_hazo_logger(config);
 *
 * // Pass to initialize_llm_api
 * await initialize_llm_api({ logger });
 * ```
 */

// Re-export types
export type { HazoLoggerConfig, LogLevel } from './types.js';

// Re-export factory function
export { create_winston_logger as create_hazo_logger } from './winston_logger.js';

// Re-export config parser
export { parse_logging_config } from './config_parser.js';

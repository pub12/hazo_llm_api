/**
 * hazo_logs Types
 *
 * Type definitions for the hazo_logs logging module.
 */

/**
 * Log level type - matches Winston log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Configuration options for the hazo_logs Winston logger
 */
export interface HazoLoggerConfig {
  /** Full path to log file */
  log_file: string;

  /** Minimum log level (default: 'info') */
  log_level: LogLevel;

  /** Max file size before rotation (e.g., '10m', '100k') */
  max_size?: string;

  /** Max number of rotated files to keep */
  max_files?: number;

  /** Also log to console (default: true) */
  console_enabled?: boolean;
}

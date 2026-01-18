/**
 * hazo_logs Winston Logger
 *
 * Winston-based logger implementation that satisfies the Logger interface.
 * Provides file-based logging with daily rotation and optional console output.
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import * as fs from 'fs';
import * as path from 'path';
import type { Logger } from '../llm_api/types.js';
import type { HazoLoggerConfig } from './types.js';

/**
 * Create a Winston logger instance that implements the Logger interface
 *
 * @param config - Logger configuration options
 * @returns Logger instance compatible with hazo_llm_api
 */
export function create_winston_logger(config: HazoLoggerConfig): Logger {
  // Ensure log directory exists
  const log_dir = path.dirname(config.log_file);
  if (!fs.existsSync(log_dir)) {
    fs.mkdirSync(log_dir, { recursive: true });
  }

  // Custom format: YYYY-MM-DD HH:mm:ss.SSS [LEVEL] message {meta}
  const custom_format = winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const meta_str = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level.toUpperCase()}] ${message}${meta_str}`;
  });

  // Create transports array
  const transports: winston.transport[] = [];

  // File transport with daily rotation
  const file_transport = new DailyRotateFile({
    filename: config.log_file.replace(/\.log$/, '-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: config.max_size || '10m',
    maxFiles: config.max_files ? `${config.max_files}` : '5',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      custom_format
    ),
  });

  transports.push(file_transport);

  // Console transport (optional, defaults to true)
  if (config.console_enabled !== false) {
    const console_transport = new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        custom_format
      ),
    });
    transports.push(console_transport);
  }

  // Create Winston logger
  const winston_logger = winston.createLogger({
    level: config.log_level || 'info',
    transports,
  });

  // Return Logger interface implementation
  return {
    error: (message: string, meta?: Record<string, unknown>) => {
      winston_logger.error(message, meta);
    },
    info: (message: string, meta?: Record<string, unknown>) => {
      winston_logger.info(message, meta);
    },
    warn: (message: string, meta?: Record<string, unknown>) => {
      winston_logger.warn(message, meta);
    },
    debug: (message: string, meta?: Record<string, unknown>) => {
      winston_logger.debug(message, meta);
    },
  };
}

import fs from 'node:fs/promises';
import path from 'node:path';

const logFilePath = path.join(__dirname, 'application.log');

const logToFile = async (message: string) => {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  try {
    await fs.appendFile(logFilePath, `${new Date().toISOString()} - ${message}\n`);
  } catch (error) {
    console.error('Error writing to log file:', error);
  }
};

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const log = (level: LogLevel, ...args: unknown[]) => {
  const message = `${level.toUpperCase()}: ${args
    .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
    .join(' ')}`;

  if (level === 'info' || level === 'warn' || level === 'error') {
    console[level](message);
  }

  logToFile(message);
};

export const logger = {
  debug: (...args: unknown[]) => {
    log('debug', ...args);
  },
  info: (...args: unknown[]) => {
    log('info', ...args);
  },
  warn: (...args: unknown[]) => {
    log('warn', ...args);
  },
  error: (...args: unknown[]) => {
    log('error', ...args);
  },
};
import { app } from 'electron';
import * as path from 'path';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

const logDirectory = path.join(app.getPath('userData'), 'logs');

const fileRotateTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logDirectory, 'resetter-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
});

const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  ),
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  transports: [
    fileRotateTransport,
    consoleTransport
  ],
});

export default logger; 
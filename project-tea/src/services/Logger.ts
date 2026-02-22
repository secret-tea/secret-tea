import * as vscode from 'vscode';
import { ILogger, LogLevel } from './interfaces';

// Logger service provides logging with different log levels
export class Logger implements ILogger {
  private outputChannel: vscode.OutputChannel;
  private logLevel: LogLevel;

  constructor(context: vscode.ExtensionContext, logLevel: LogLevel = LogLevel.Info) {
    this.outputChannel = vscode.window.createOutputChannel('Secret Tea');
    this.logLevel = logLevel;
    context.subscriptions.push(this.outputChannel);
  }

  debug(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.Debug) {
      this.log('DEBUG', message, data);
    }
  }

  info(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.Info) {
      this.log('INFO', message, data);
    }
  }

  warn(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.Warn) {
      this.log('WARN', message, data);
    }
  }

  error(message: string, error?: Error): void {
    if (this.logLevel <= LogLevel.Error) {
      this.log('ERROR', message, error);
      if (error?.stack) {
        this.outputChannel.appendLine(error.stack);
      }
    }
  }

  show(): void {
    this.outputChannel.show();
  }

  dispose(): void {
    this.outputChannel.dispose();
  }

  private log(level: string, message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] [${level}] ${message}`);

    if (data !== undefined) {
      if (data instanceof Error) {
        this.outputChannel.appendLine(`  Error: ${data.message}`);
        if (data.stack) {
          this.outputChannel.appendLine(`  Stack: ${data.stack}`);
        }
      } else if (typeof data === 'object') {
        this.outputChannel.appendLine(`  Data: ${JSON.stringify(data, null, 2)}`);
      } else {
        this.outputChannel.appendLine(`  Data: ${data}`);
      }
    }
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.info(`Log level changed to ${LogLevel[level]}`);
  }

  getLogLevel(): LogLevel {
    return this.logLevel;
  }
}
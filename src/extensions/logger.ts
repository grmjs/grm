export enum LogLevel {
  NONE = "none",
  ERROR = "error",
  WARN = "warn",
  INFO = "info",
  DEBUG = "debug",
}

export class Logger {
  private levels = ["error", "warn", "info", "debug"];
  private colors: {
    warn: string;
    debug: string;
    start: string;
    end: string;
    error: string;
    info: string;
  };
  public messageFormat: string;
  private _logLevel: LogLevel | `${LogLevel}`;
  public tzOffset: number;

  constructor(level?: LogLevel) {
    this._logLevel = level || LogLevel.INFO;
    this.colors = {
      start: "\x1b[2m",
      warn: "\x1b[35m",
      info: "\x1b[33m",
      debug: "\x1b[36m",
      error: "\x1b[31m",
      end: "\x1b[0m",
    };
    this.messageFormat = "[%t] [%l] - [%m]";
    this.tzOffset = new Date().getTimezoneOffset() * 60000;
  }

  canSend(level: LogLevel) {
    return this._logLevel
      ? this.levels.indexOf(this._logLevel) >= this.levels.indexOf(level)
      : false;
  }

  warn(message: string) {
    this._log(LogLevel.WARN, message, this.colors.warn);
  }

  info(message: string) {
    this._log(LogLevel.INFO, message, this.colors.info);
  }

  debug(message: string) {
    this._log(LogLevel.DEBUG, message, this.colors.debug);
  }

  error(message: string) {
    this._log(LogLevel.ERROR, message, this.colors.error);
  }

  format(message: string, level: string) {
    return this.messageFormat
      .replace("%t", this.getDateTime())
      .replace("%l", level.toUpperCase())
      .replace("%m", message);
  }

  get logLevel() {
    return this._logLevel;
  }

  setLevel(level: LogLevel | `${LogLevel}`) {
    this._logLevel = level;
  }

  static setLevel(_level: string) {
    console.log(
      "Logger.setLevel is deprecated, it will has no effect. Please, use client.setLogLevel instead.",
    );
  }

  _log(level: LogLevel, message: string, color: string) {
    if (this.canSend(level)) {
      this.log(level, message, color);
    } else {
      return;
    }
  }

  log(level: LogLevel, message: string, color: string) {
    console.log(this.colors.start + this.format(message, level), color);
  }

  getDateTime() {
    return new Date(Date.now() - this.tzOffset).toISOString().slice(0, -1);
  }
}

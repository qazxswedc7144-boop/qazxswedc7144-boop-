
export class LoggerService {
  static info(msg: string, meta?: any, extra?: any) {
    if (extra !== undefined) {
      console.info(`[INFO] [${msg}] [${meta}] ${extra}`);
    } else {
      console.info(`[INFO] ${msg}`, meta || '');
    }
  }

  static error(msg: string, error?: any, extra?: any) {
    if (extra !== undefined) {
      console.error(`[ERROR] [${msg}] [${error}] ${extra}`);
    } else {
      console.error(`[ERROR] ${msg}`, error || '');
    }
  }

  static warn(msg: string, meta?: any, extra?: any) {
    if (extra !== undefined) {
      console.warn(`[WARN] [${msg}] [${meta}] ${extra}`);
    } else {
      console.warn(`[WARN] ${msg}`, meta || '');
    }
  }

  static critical(msg: string, module: string, details?: string) {
    console.error(`[CRITICAL] [${module}] ${msg}`, details || '');
  }
}

export const logger = LoggerService;


import { db } from './database';
import { authService } from './auth.service';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

/**
 * Professional Logger - محرك التسجيل المؤسسي
 */
class LoggerService {
  
  private async log(level: LogLevel, action: string, entity: string, details: string) {
    const user = authService.getCurrentUser();
    const timestamp = new Date().toISOString();
    
    // تسجيل في الـ Console للمطورين
    const color = level === 'ERROR' || level === 'CRITICAL' ? 'red' : level === 'WARN' ? 'orange' : 'green';
    console.log(`%c[${level}] %c${timestamp} - ${action}: ${details}`, `color: ${color}; font-weight: bold`, 'color: gray');

    // الحفظ الدائم في قاعدة البيانات للرقابة
    await db.addAuditLog(
      'SYSTEM', 
      'OTHER', 
      entity, 
      `[${level}] ${action}: ${details}`
    );
  }

  private mapLevelToSeverity(level: LogLevel): any {
    if (level === 'CRITICAL') return 'critical';
    if (level === 'ERROR') return 'error';
    if (level === 'WARN') return 'warning';
    return 'info';
  }

  public info(action: string, entity: string, details: string) {
    this.log('INFO', action, entity, details);
  }

  public warn(action: string, entity: string, details: string) {
    this.log('WARN', action, entity, details);
  }

  public error(action: string, entity: string, details: string, error?: any) {
    const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
    this.log('ERROR', action, entity, `${details} | Error: ${errorMsg}`);
  }

  public critical(action: string, entity: string, details: string) {
    this.log('CRITICAL', action, entity, details);
  }
}

export const logger = new LoggerService();

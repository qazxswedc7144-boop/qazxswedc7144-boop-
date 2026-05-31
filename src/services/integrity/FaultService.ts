export class FaultService {
  static handleFault(error: any, context?: string) {
    console.warn(`[FaultService] ${context || 'Unknown context'}:`, error);
  }

  static log(msgOrPayload: string | any, error?: any) {
    if (typeof msgOrPayload === 'object' && msgOrPayload !== null) {
      this.handleFault(msgOrPayload.error || msgOrPayload.message, msgOrPayload.type || msgOrPayload.module);
    } else {
      this.handleFault(error, msgOrPayload);
    }
  }

  static logTransactionFault(source: string, msg: string, payload: any, error: any) {
    this.handleFault(error, `[${source}] ${msg} | ${JSON.stringify(payload)}`);
  }
}

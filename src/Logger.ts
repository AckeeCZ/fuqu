enum LogLevel {
    Debug = 'debug',
    Error = 'error',
}

export default class Logger {
    constructor(private logger: any, private debug: boolean) {}
    public logError(message: string, data?: any) {
        this.log(LogLevel.Error, data, message);
    }
    public logDebug(message: string, data?: any) {
        if (this.debug) {
            this.log(LogLevel.Debug, data, message);
        }
    }
    private log(level: LogLevel, message: string, data?: any) {
        if (data) {
            this.logger[level](data, message);
        } else {
            this.logger[level](message);
        }
    }
}

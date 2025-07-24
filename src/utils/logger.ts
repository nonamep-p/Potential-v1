export class Logger {
    private formatTime(): string {
        return new Date().toISOString();
    }

    info(message: string, ...args: any[]) {
        console.log(`[${this.formatTime()}] [INFO] ${message}`, ...args);
    }

    error(message: string, ...args: any[]) {
        console.error(`[${this.formatTime()}] [ERROR] ${message}`, ...args);
    }

    warn(message: string, ...args: any[]) {
        console.warn(`[${this.formatTime()}] [WARN] ${message}`, ...args);
    }

    debug(message: string, ...args: any[]) {
        console.debug(`[${this.formatTime()}] [DEBUG] ${message}`, ...args);
    }
}

export const logger = new Logger();

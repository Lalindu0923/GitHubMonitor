import { EventEmitter } from "events";

class Logger extends EventEmitter {
  constructor() {
    super();
  }

  log(message, data = null) {
    const logEntry = {
      message,
      data,
      timestamp: new Date().toISOString(),
      level: "info",
    };
    // Emit to SSE clients
    this.emit("log", logEntry);
    
    // Also log to terminal
    if (data) {
      console.log(`[INFO] ${message}`, data);
    } else {
      console.log(`[INFO] ${message}`);
    }
  }

  error(message, error = null) {
    const logEntry = {
      message,
      error: error?.message || error,
      timestamp: new Date().toISOString(),
      level: "error",
    };
    this.emit("log", logEntry);
    
    if (error) {
      console.error(`[ERROR] ${message}`, error);
    } else {
      console.error(`[ERROR] ${message}`);
    }
  }

  success(message, data = null) {
    const logEntry = {
      message,
      data,
      timestamp: new Date().toISOString(),
      level: "success",
    };
    this.emit("log", logEntry);
    
    if (data) {
      console.log(`[SUCCESS] ${message}`, data);
    } else {
      console.log(`[SUCCESS] ${message}`);
    }
  }
}

export const logEmitter = new Logger();

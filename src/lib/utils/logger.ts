// Conditional logger that only logs in development
const isDev = process.env.NODE_ENV === 'development'

export const logger = {
  debug: (message: string, data?: any) => {
    if (isDev) {
      console.log(`[DEBUG] ${message}`, data || '')
    }
  },
  info: (message: string, data?: any) => {
    if (isDev) {
      console.info(`[INFO] ${message}`, data || '')
    }
  },
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${message}`, data || '')
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error || '')
  }
}

export const performanceLogger = {
  start: (label: string) => {
    if (isDev) {
      console.time(label)
    }
  },
  end: (label: string) => {
    if (isDev) {
      console.timeEnd(label)
    }
  }
}
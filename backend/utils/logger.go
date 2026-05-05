package utils

import (
	"log"
	"os"
	"sync"
)

var (
	infoLogger    *log.Logger
	warningLogger *log.Logger
	errorLogger   *log.Logger
	loggerOnce    sync.Once
)

// InitLoggers initializes the application loggers
func InitLoggers() {
	loggerOnce.Do(func() {
		// ANSI escape codes for colors
		const (
			Reset  = "\033[0m"
			Red    = "\033[31m"
			Green  = "\033[32m"
			Yellow = "\033[33m"
			Blue   = "\033[34m"
		)

		// Initialize loggers with color prefixes and cleaner flags
		infoLogger = log.New(os.Stdout, Green+"INFO: "+Reset, log.Ldate|log.Ltime)
		warningLogger = log.New(os.Stdout, Yellow+"WARNING: "+Reset, log.Ldate|log.Ltime)
		errorLogger = log.New(os.Stderr, Red+"ERROR: "+Reset, log.Ldate|log.Ltime|log.Lshortfile)
	})
}

// LogInfo logs informational messages
func LogInfo(format string, v ...interface{}) {
	if infoLogger == nil {
		InitLoggers()
	}
	infoLogger.Printf(format, v...)
}

// LogWarning logs warning messages
func LogWarning(format string, v ...interface{}) {
	if warningLogger == nil {
		InitLoggers()
	}
	warningLogger.Printf(format, v...)
}

// LogError logs error messages
func LogError(format string, v ...interface{}) {
	if errorLogger == nil {
		InitLoggers()
	}
	errorLogger.Printf(format, v...)
}

// utils/logger.js
const winston = require('winston');
const { combine, timestamp, printf, colorize } = winston.format;

// Формат виводу: 2026-04-13 14:30:00 [INFO]: message
const myFormat = printf(({ level, message, timestamp }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${message}`;
});

module.exports = winston.createLogger({
    level: 'info', // Рівень логування (info, warn, error)
    format: combine(
        colorize(), // Додає кольори в консоль (Render підтримує)
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        myFormat
    ),
    transports: [
        new winston.transports.Console() // Вивід у консоль (для Render)
    ]
});
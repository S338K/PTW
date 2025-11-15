require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';

// Core settings
const PORT = Number(process.env.PORT || 5000);
const MONGO_URI = process.env.MONGO_URI;

// Sessions
const SESSION_SECRET_DEV =
  process.env.SESSION_SECRET_DEV || 'PTW-2024-simple-dev-session-key-for-local-testing';
const SESSION_SECRET_PROD = process.env.SESSION_SECRET_PROD;

// CORS
const ALLOWED_ORIGIN = (process.env.ALLOWED_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Puppeteer/Chromium
const PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH;
const PUPPETEER_CACHE_DIR = process.env.PUPPETEER_CACHE_DIR;

// Weather
const WEATHER_API_KEY = process.env.API_KEY || process.env.WEATHER_API_KEY || '';

// Frontend base for auth flows
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'https://s338k.github.io';

// Logging
const LOG_LEVEL = process.env.LOG_LEVEL || (isProd ? 'info' : 'debug');

module.exports = {
  isProd,
  PORT,
  MONGO_URI,
  SESSION_SECRET_DEV,
  SESSION_SECRET_PROD,
  ALLOWED_ORIGIN,
  PUPPETEER_EXECUTABLE_PATH,
  PUPPETEER_CACHE_DIR,
  WEATHER_API_KEY,
  FRONTEND_BASE_URL,
  LOG_LEVEL,
};

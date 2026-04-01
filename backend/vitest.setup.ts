// Stub required env vars that are always needed for module-level imports
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://test:test@localhost/test';
process.env.SECRET_ENCRYPTION_KEY =
  process.env.SECRET_ENCRYPTION_KEY ??
  'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
process.env.ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'password123';
process.env.BROWSERLESS_WS_URL =
  process.env.BROWSERLESS_WS_URL ?? 'ws://browserless:3000/chromium/playwright';
process.env.BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN ?? 'test-token';
process.env.API_KEY = process.env.API_KEY ?? 'a-valid-api-key-at-least-16';

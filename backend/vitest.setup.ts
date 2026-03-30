// Stub required env vars that are always needed for module-level imports
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://test:test@localhost/test';

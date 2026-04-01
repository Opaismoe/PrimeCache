// Stub required env vars that are always needed for module-level imports
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://test:test@localhost/test';
process.env.SECRET_ENCRYPTION_KEY =
  process.env.SECRET_ENCRYPTION_KEY ?? 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

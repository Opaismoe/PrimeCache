-- Webhook tokens: store sha256(hex) instead of plaintext. Existing rows are
-- hashed in place; callers keep using the plaintext they were issued.
UPDATE "webhook_tokens" SET "token" = encode(sha256(convert_to("token", 'UTF8')), 'hex');

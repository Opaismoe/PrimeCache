import { decrypt } from '../secrets/crypto';
import { getSecret } from '../db/queries/secrets';
import { env } from './env';
import type { Config } from './urls';
import type { Db } from '../db/client';

const PREFIX = 'secret:';

async function resolveValue(value: string, db: Db): Promise<string> {
  if (!value.startsWith(PREFIX)) return value;
  const name = value.slice(PREFIX.length);
  const row = await getSecret(db, name);
  if (!row) throw new Error(`Config references unknown secret: "${name}"`);
  return decrypt(row.encrypted_value, env.SECRET_ENCRYPTION_KEY);
}

export async function resolveConfigSecrets(config: Config, db: Db): Promise<Config> {
  const clone = structuredClone(config);
  for (const group of clone.groups) {
    const opts = group.options;
    if (opts.basicAuth) {
      opts.basicAuth.username = await resolveValue(opts.basicAuth.username, db);
      opts.basicAuth.password = await resolveValue(opts.basicAuth.password, db);
    }
    if (opts.cookies) {
      for (const cookie of opts.cookies) {
        cookie.value = await resolveValue(cookie.value, db);
      }
    }
    if (opts.userAgent) {
      opts.userAgent = await resolveValue(opts.userAgent, db);
    }
  }
  return clone;
}

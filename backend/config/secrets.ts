import type { Db } from '../db/client';
import { getSecret } from '../db/queries/secrets';
import { decrypt } from '../secrets/crypto';
import { env } from './env';
import type { Config } from './urls';

const PREFIX = 'secret:';

async function resolveValue(value: string, db: Db): Promise<string> {
  if (!value.startsWith(PREFIX)) return value;
  const name = value.slice(PREFIX.length);
  const row = await getSecret(db, name);
  if (!row) throw new Error(`Config references unknown secret: "${name}"`);
  return decrypt(row.encrypted_value, env.SECRET_ENCRYPTION_KEY);
}

/** Every `secret:name` reference in the config, with the group that uses it. */
export function listSecretRefs(config: Config): Array<{ name: string; group: string }> {
  const refs: Array<{ name: string; group: string }> = [];
  const add = (value: string | undefined, group: string) => {
    if (value?.startsWith(PREFIX)) refs.push({ name: value.slice(PREFIX.length), group });
  };
  for (const group of config.groups) {
    const opts = group.options;
    add(opts.basicAuth?.username, group.name);
    add(opts.basicAuth?.password, group.name);
    for (const cookie of opts.cookies ?? []) add(cookie.value, group.name);
    add(opts.userAgent, group.name);
  }
  return refs;
}

/** Names of referenced secrets that are not in the store (deduplicated). */
export async function findMissingSecretRefs(config: Config, db: Db): Promise<string[]> {
  const names = [...new Set(listSecretRefs(config).map((r) => r.name))];
  const missing: string[] = [];
  for (const name of names) {
    if (!(await getSecret(db, name))) missing.push(name);
  }
  return missing;
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

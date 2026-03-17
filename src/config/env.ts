import { z } from 'zod'

// Treat empty strings as undefined so .default() values apply
const empty = (val: unknown) => (val === '' ? undefined : val)

const EnvSchema = z.object({
  BROWSERLESS_WS_URL:  z.string().min(1, 'BROWSERLESS_WS_URL is required'),
  BROWSERLESS_TOKEN:   z.string().min(1, 'BROWSERLESS_TOKEN is required'),
  API_KEY:             z.string().min(16, 'API_KEY must be at least 16 characters'),
  DB_PATH:             z.preprocess(empty, z.string().default('/app/data/warmer.db')),
  CONFIG_PATH:         z.preprocess(empty, z.string().default('/app/config/config.yaml')),
  PORT:                z.preprocess(empty, z.coerce.number().default(3000)),
  LOG_LEVEL:           z.preprocess(empty, z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info')),
  TIMEZONE:            z.preprocess(empty, z.string().default('Europe/Amsterdam')),
  BETWEEN_URLS_MIN_MS: z.preprocess(empty, z.coerce.number().default(2000)),
  BETWEEN_URLS_MAX_MS: z.preprocess(empty, z.coerce.number().default(5000)),
})

export type Env = z.infer<typeof EnvSchema>

export const env: Env = EnvSchema.parse(process.env)

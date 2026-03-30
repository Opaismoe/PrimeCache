import { z } from 'zod'
import yaml from 'js-yaml'
import fs from 'fs'
import chokidar from 'chokidar'

const GroupOptionsSchema = z.object({
  scrollToBottom:      z.boolean().default(false),
  waitForSelector:     z.string().optional(),
  crawl:               z.boolean().default(false),
  crawl_depth:         z.number().int().min(1).max(10).optional(),
  userAgent:           z.string().optional(),
  localStorage:        z.record(z.string(), z.string()).optional(),
  cookies:             z.array(z.object({
    name:      z.string(),
    value:     z.string(),
    url:       z.string().optional(),
    domain:    z.string().optional(),
    path:      z.string().optional(),
    httpOnly:  z.boolean().optional(),
    secure:    z.boolean().optional(),
    sameSite:  z.enum(['Strict', 'Lax', 'None']).optional(),
    expires:   z.number().optional(),
  })).optional(),
  basicAuth:           z.object({
    username: z.string(),
    password: z.string(),
  }).optional(),
  navigationTimeout:   z.number().int().min(5_000).default(30_000),
  waitUntil:           z.enum(['networkidle', 'load', 'domcontentloaded']).default('networkidle'),
  delayMinMs:          z.number().int().min(0).optional(),
  delayMaxMs:          z.number().int().min(0).optional(),
  fetchAssets:         z.boolean().default(true),
  stealth:             z.boolean().default(true),
  screenshot:          z.boolean().default(false),
  checkBrokenLinks:    z.boolean().default(false),
  retryCount:          z.number().int().min(0).max(10).default(3),
}).refine(
  (opts) => !opts.crawl || opts.crawl_depth !== undefined,
  { message: 'crawl_depth is required when crawl is true' },
)

const GroupSchema = z.object({
  name:     z.string().min(1, 'Group name is required'),
  schedule: z.string().min(1, 'Group schedule is required'),
  urls:     z.array(z.string().url('Each URL must be a valid URL')).min(1, 'At least one URL is required'),
  // preprocess: missing options block → {} so per-field defaults apply
  options:  z.preprocess((v) => v ?? {}, GroupOptionsSchema),
})

export const ConfigSchema = z.object({
  groups: z.array(GroupSchema).min(1, 'At least one group is required'),
})

export type WarmGroup = z.infer<typeof GroupSchema>
export type Config    = z.infer<typeof ConfigSchema>

export function parseConfig(yamlContent: string): Config {
  const raw = yaml.load(yamlContent)
  return ConfigSchema.parse(raw)
}

export function loadConfig(filePath: string): Config {
  const content = fs.readFileSync(filePath, 'utf-8')
  return parseConfig(content)
}

export function watchConfig(filePath: string, onChange: (config: Config) => void): () => void {
  const watcher = chokidar.watch(filePath, { ignoreInitial: true })

  watcher.on('change', () => {
    try {
      const config = loadConfig(filePath)
      onChange(config)
    } catch (err) {
      // Invalid config on disk — keep running with the previous config
      console.error('Failed to reload config.yaml:', err)
    }
  })

  return () => watcher.close()
}

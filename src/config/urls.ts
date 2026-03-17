import { z } from 'zod'
import yaml from 'js-yaml'
import fs from 'fs'
import chokidar from 'chokidar'

const GroupOptionsSchema = z.object({
  scrollToBottom:   z.boolean().default(false),
  waitForSelector:  z.string().optional(),
  crawl:            z.boolean().default(false),
  crawl_depth:      z.number().int().min(1).max(10).optional(),
}).refine(
  (opts) => !opts.crawl || opts.crawl_depth !== undefined,
  { message: 'crawl_depth is required when crawl is true' },
).default({ scrollToBottom: false, crawl: false })

const GroupSchema = z.object({
  name:     z.string().min(1, 'Group name is required'),
  schedule: z.string().min(1, 'Group schedule is required'),
  urls:     z.array(z.string().url('Each URL must be a valid URL')).min(1, 'At least one URL is required'),
  options:  GroupOptionsSchema,
})

const ConfigSchema = z.object({
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

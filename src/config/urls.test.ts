import { describe, it, expect } from 'vitest'
import { parseConfig } from './urls'

const VALID_YAML = `
groups:
  - name: homepage
    schedule: "*/15 * * * *"
    urls:
      - https://example.com/
    options:
      scrollToBottom: true
      waitForSelector: "main"
  - name: products
    schedule: "0 * * * *"
    urls:
      - https://example.com/products
`

describe('parseConfig', () => {
  it('parses a valid config.yaml', () => {
    const config = parseConfig(VALID_YAML)
    expect(config.groups).toHaveLength(2)
    expect(config.groups[0].name).toBe('homepage')
    expect(config.groups[0].urls).toEqual(['https://example.com/'])
    expect(config.groups[0].options.scrollToBottom).toBe(true)
    expect(config.groups[0].options.waitForSelector).toBe('main')
  })

  it('applies default options when options block is omitted', () => {
    const config = parseConfig(VALID_YAML)
    expect(config.groups[1].options.scrollToBottom).toBe(false)
    expect(config.groups[1].options.waitForSelector).toBeUndefined()
  })

  it('throws when groups array is empty', () => {
    const yaml = `groups: []`
    expect(() => parseConfig(yaml)).toThrow()
  })

  it('throws when a group has no urls', () => {
    const yaml = `
groups:
  - name: empty
    schedule: "0 * * * *"
    urls: []
`
    expect(() => parseConfig(yaml)).toThrow()
  })

  it('throws when a url is not a valid URL', () => {
    const yaml = `
groups:
  - name: bad
    schedule: "0 * * * *"
    urls:
      - not-a-url
`
    expect(() => parseConfig(yaml)).toThrow()
  })

  it('throws when group name is missing', () => {
    const yaml = `
groups:
  - schedule: "0 * * * *"
    urls:
      - https://example.com/
`
    expect(() => parseConfig(yaml)).toThrow()
  })

  it('throws when schedule is missing', () => {
    const yaml = `
groups:
  - name: test
    urls:
      - https://example.com/
`
    expect(() => parseConfig(yaml)).toThrow()
  })

  it('throws on invalid YAML syntax', () => {
    expect(() => parseConfig('groups: [invalid: yaml: {')).toThrow()
  })
})

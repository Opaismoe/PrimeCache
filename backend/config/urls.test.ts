import { describe, expect, it } from 'vitest';
import { parseConfig } from './urls';

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
`;

describe('parseConfig', () => {
  it('parses a valid config.yaml', () => {
    const config = parseConfig(VALID_YAML);
    expect(config.groups).toHaveLength(2);
    expect(config.groups[0].name).toBe('homepage');
    expect(config.groups[0].urls).toEqual(['https://example.com/']);
    expect(config.groups[0].options.scrollToBottom).toBe(true);
    expect(config.groups[0].options.waitForSelector).toBe('main');
  });

  it('applies default options when options block is omitted', () => {
    const config = parseConfig(VALID_YAML);
    expect(config.groups[1].options.scrollToBottom).toBe(false);
    expect(config.groups[1].options.waitForSelector).toBeUndefined();
  });

  it('throws when groups array is empty', () => {
    const yaml = `groups: []`;
    expect(() => parseConfig(yaml)).toThrow();
  });

  it('throws when a group has no urls', () => {
    const yaml = `
groups:
  - name: empty
    schedule: "0 * * * *"
    urls: []
`;
    expect(() => parseConfig(yaml)).toThrow();
  });

  it('throws when a url is not a valid URL', () => {
    const yaml = `
groups:
  - name: bad
    schedule: "0 * * * *"
    urls:
      - not-a-url
`;
    expect(() => parseConfig(yaml)).toThrow();
  });

  it('throws when group name is missing', () => {
    const yaml = `
groups:
  - schedule: "0 * * * *"
    urls:
      - https://example.com/
`;
    expect(() => parseConfig(yaml)).toThrow();
  });

  it('throws when schedule is missing', () => {
    const yaml = `
groups:
  - name: test
    urls:
      - https://example.com/
`;
    expect(() => parseConfig(yaml)).toThrow();
  });

  it('throws on invalid YAML syntax', () => {
    expect(() => parseConfig('groups: [invalid: yaml: {')).toThrow();
  });

  it('accepts crawl: true with crawl_depth', () => {
    const yaml = `
groups:
  - name: crawl-test
    schedule: "0 * * * *"
    urls:
      - https://example.com/
    options:
      crawl: true
      crawl_depth: 2
`;
    const config = parseConfig(yaml);
    expect(config.groups[0].options.crawl).toBe(true);
    expect(config.groups[0].options.crawl_depth).toBe(2);
  });

  it('throws when crawl is true but crawl_depth is missing', () => {
    const yaml = `
groups:
  - name: crawl-test
    schedule: "0 * * * *"
    urls:
      - https://example.com/
    options:
      crawl: true
`;
    expect(() => parseConfig(yaml)).toThrow();
  });

  it('defaults crawl to false when omitted', () => {
    const config = parseConfig(VALID_YAML);
    expect(config.groups[0].options.crawl).toBe(false);
    expect(config.groups[0].options.crawl_depth).toBeUndefined();
  });

  it('defaults fetchAssets to true when omitted', () => {
    const config = parseConfig(VALID_YAML);
    expect(config.groups[0].options.fetchAssets).toBe(true);
  });

  it('defaults retryCount to 3 when omitted', () => {
    const config = parseConfig(VALID_YAML);
    expect(config.groups[0].options.retryCount).toBe(3);
  });

  it('accepts retryCount: 0', () => {
    const yaml = `
groups:
  - name: no-retry
    schedule: "0 * * * *"
    urls:
      - https://example.com/
    options:
      retryCount: 0
`;
    const config = parseConfig(yaml);
    expect(config.groups[0].options.retryCount).toBe(0);
  });

  it('accepts retryCount: 5', () => {
    const yaml = `
groups:
  - name: retry-test
    schedule: "0 * * * *"
    urls:
      - https://example.com/
    options:
      retryCount: 5
`;
    const config = parseConfig(yaml);
    expect(config.groups[0].options.retryCount).toBe(5);
  });

  it('accepts fetchAssets: false', () => {
    const yaml = `
groups:
  - name: no-assets
    schedule: "0 * * * *"
    urls:
      - https://example.com/
    options:
      fetchAssets: false
`;
    const config = parseConfig(yaml);
    expect(config.groups[0].options.fetchAssets).toBe(false);
  });

  it('accepts checkAccessibility: true', () => {
    const yaml = `
groups:
  - name: a11y-test
    schedule: "0 * * * *"
    urls:
      - https://example.com/
    options:
      checkAccessibility: true
`;
    const config = parseConfig(yaml);
    expect(config.groups[0].options.checkAccessibility).toBe(true);
  });

  it('defaults checkAccessibility to false when omitted', () => {
    const config = parseConfig(VALID_YAML);
    expect(config.groups[0].options.checkAccessibility).toBe(false);
  });
});

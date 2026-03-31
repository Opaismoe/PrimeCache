import type { Browser, BrowserContext, Page } from 'playwright';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubEnv('BROWSERLESS_WS_URL', 'ws://browserless:3000/chromium/playwright');
vi.stubEnv('BROWSERLESS_TOKEN', 'test-token');
vi.stubEnv('API_KEY', 'a-valid-api-key-at-least-16');

// Mock the browser layer so no real connections are made
vi.mock('../browser/connection', () => ({ getBrowser: vi.fn(), resetBrowser: vi.fn() }));
vi.mock('../browser/context', () => ({ createContext: vi.fn() }));
vi.mock('@axe-core/playwright', () => ({
  AxeBuilder: vi.fn().mockImplementation(function () {
    return {
      analyze: vi.fn().mockResolvedValue({
        violations: [
          { id: 'color-contrast', impact: 'serious', help: 'Elements must have sufficient color contrast', description: 'Ensures the contrast ratio...', helpUrl: 'https://dequeuniversity.com/rules/axe/4.9/color-contrast', nodes: [{}, {}] },
          { id: 'button-name', impact: 'critical', help: 'Buttons must have discernible text', description: 'Ensures buttons have discernible text', helpUrl: 'https://dequeuniversity.com/rules/axe/4.9/button-name', nodes: [{}] },
        ],
      }),
    };
  }),
}));
vi.mock('../browser/stealth', () => ({
  simulateMouseMovement: vi.fn().mockResolvedValue(undefined),
  simulateScroll: vi.fn().mockResolvedValue(undefined),
  simulateReading: vi.fn().mockResolvedValue(undefined),
  randomDelay: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../browser/cookieConsent', () => ({
  dismissCookieConsent: vi
    .fn()
    .mockResolvedValue({ found: true, strategy: 'cookiebot', durationMs: 50 }),
}));

function makeMockPage(statusCode = 200, links: string[] = []) {
  const page = {
    on: vi.fn((event, handler) => {
      if (event === 'response') {
        handler({
          url: () => 'https://example.com/',
          status: () => statusCode,
          headers: () => ({}),
        });
      }
    }),
    route: vi.fn().mockResolvedValue(undefined),
    addInitScript: vi.fn().mockResolvedValue(undefined),
    goto: vi.fn().mockResolvedValue({
      status: () => statusCode,
      url: () => 'https://example.com/',
      request: () => ({ redirectedFrom: () => null }),
    }),
    url: vi.fn().mockReturnValue('https://example.com/'),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    evaluate: vi
      .fn()
      .mockResolvedValueOnce(null) // nav timing — returns null → fallback to wall clock
      .mockResolvedValue(links), // SEO, CWV, link extraction
  };
  return page as unknown as Page;
}

function makeMockContext(page: Page): BrowserContext {
  return {
    newPage: vi.fn().mockResolvedValue(page),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as BrowserContext;
}

describe('visitUrl', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getBrowser } = await import('../browser/connection');
    const { createContext } = await import('../browser/context');
    const page = makeMockPage();
    const ctx = makeMockContext(page);
    vi.mocked(getBrowser).mockResolvedValue({} as unknown as Browser);
    vi.mocked(createContext).mockResolvedValue(ctx);
  });

  it('returns a VisitResult with statusCode and url', async () => {
    const { visitUrl } = await import('./visitor');
    const result = await visitUrl('https://example.com/', { scrollToBottom: false, crawl: false });
    expect(result.url).toBe('https://example.com/');
    expect(result.statusCode).toBe(200);
    expect(result.error).toBeNull();
  });

  it('includes consent result in VisitResult', async () => {
    const { visitUrl } = await import('./visitor');
    const result = await visitUrl('https://example.com/', { scrollToBottom: false, crawl: false });
    expect(result.consentFound).toBe(true);
    expect(result.consentStrategy).toBe('cookiebot');
  });

  it('always closes the context even when an error occurs', async () => {
    const { createContext } = await import('../browser/context');
    const page = makeMockPage();
    page.goto = vi.fn().mockRejectedValue(new Error('Navigation timeout'));
    const ctx = makeMockContext(page);
    vi.mocked(createContext).mockResolvedValue(ctx);

    const { visitUrl } = await import('./visitor');
    const result = await visitUrl('https://example.com/', { scrollToBottom: false, crawl: false });
    expect(ctx.close).toHaveBeenCalledOnce();
    expect(result.error).toContain('Navigation timeout');
  });

  it('captures loadTimeMs', async () => {
    const { visitUrl } = await import('./visitor');
    const result = await visitUrl('https://example.com/', { scrollToBottom: false, crawl: false });
    expect(typeof result.loadTimeMs).toBe('number');
    expect(result.loadTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('does not throw even on total failure', async () => {
    const { createContext } = await import('../browser/context');
    vi.mocked(createContext).mockRejectedValue(new Error('Browserless unreachable'));
    const { visitUrl } = await import('./visitor');
    const result = await visitUrl('https://example.com/', { scrollToBottom: false, crawl: false });
    expect(result.error).toBeTruthy();
    expect(result.statusCode).toBeNull();
  });

  it('returns empty discoveredLinks when crawl is false', async () => {
    const { visitUrl } = await import('./visitor');
    const result = await visitUrl('https://example.com/', { scrollToBottom: false, crawl: false });
    expect(result.discoveredLinks).toEqual([]);
  });

  it('returns discovered same-origin links when crawl is true', async () => {
    const { createContext } = await import('../browser/context');
    const page = makeMockPage(200, [
      'https://example.com/about',
      'https://example.com/contact',
      'https://other.com/external', // different origin — should be filtered
    ]);
    vi.mocked(createContext).mockResolvedValue(makeMockContext(page));

    const { visitUrl } = await import('./visitor');
    const result = await visitUrl('https://example.com/', {
      scrollToBottom: false,
      crawl: true,
      crawl_depth: 2,
    });
    expect(result.discoveredLinks).toContain('https://example.com/about');
    expect(result.discoveredLinks).toContain('https://example.com/contact');
    expect(result.discoveredLinks).not.toContain('https://other.com/external');
  });

  it('does not call resetBrowser — context isolation is sufficient per visit', async () => {
    const { resetBrowser } = await import('../browser/connection');
    const { visitUrl } = await import('./visitor');
    await visitUrl('https://example.com/', { scrollToBottom: false, crawl: false });
    expect(vi.mocked(resetBrowser)).not.toHaveBeenCalled();
  });

  it('does not call resetBrowser even when the visit fails', async () => {
    const { createContext } = await import('../browser/context');
    const { resetBrowser } = await import('../browser/connection');
    vi.mocked(createContext).mockRejectedValue(new Error('Browserless unreachable'));
    const { visitUrl } = await import('./visitor');
    await visitUrl('https://example.com/', { scrollToBottom: false, crawl: false });
    expect(vi.mocked(resetBrowser)).not.toHaveBeenCalled();
  });

  it('passes custom userAgent to createContext', async () => {
    const { createContext } = await import('../browser/context');
    const { visitUrl } = await import('./visitor');
    const customUA = 'TerraCache/1.0.0';
    await visitUrl('https://example.com/', {
      scrollToBottom: false,
      crawl: false,
      userAgent: customUA,
    });
    expect(vi.mocked(createContext)).toHaveBeenCalledWith(expect.anything(), customUA, undefined);
  });

  it('checkAccessibility: true → result.accessibility has correct violation counts', async () => {
    const { visitUrl } = await import('./visitor');
    const result = await visitUrl('https://example.com/', {
      scrollToBottom: false,
      crawl: false,
      checkAccessibility: true,
    });
    expect(result.accessibility).not.toBeNull();
    expect(result.accessibility!.violationCount).toBe(2);
    expect(result.accessibility!.criticalCount).toBe(1);
    expect(result.accessibility!.seriousCount).toBe(1);
    expect(result.accessibility!.violations).toHaveLength(2);
    expect(result.accessibility!.violations[0].id).toBe('color-contrast');
    expect(result.accessibility!.violations[0].nodeCount).toBe(2);
    expect(result.accessibility!.violations[1].id).toBe('button-name');
    expect(result.accessibility!.violations[1].impact).toBe('critical');
  });

  it('checkAccessibility: false (default) → result.accessibility is null', async () => {
    const { visitUrl } = await import('./visitor');
    const result = await visitUrl('https://example.com/', {
      scrollToBottom: false,
      crawl: false,
    });
    expect(result.accessibility).toBeNull();
  });

  it('axe throws → result.accessibility is null but visit succeeds', async () => {
    const { AxeBuilder } = await import('@axe-core/playwright');
    vi.mocked(AxeBuilder).mockImplementationOnce(function () {
      return { analyze: vi.fn().mockRejectedValue(new Error('axe internal error')) };
    } as any);
    const { visitUrl } = await import('./visitor');
    const result = await visitUrl('https://example.com/', {
      scrollToBottom: false,
      crawl: false,
      checkAccessibility: true,
    });
    expect(result.accessibility).toBeNull();
    expect(result.error).toBeNull();
  });
});

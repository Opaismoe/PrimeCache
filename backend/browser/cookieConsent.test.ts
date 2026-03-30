import { describe, expect, it, vi } from 'vitest';
import { dismissCookieConsent } from './cookieConsent';

type ConsentPage = Parameters<typeof dismissCookieConsent>[0];

function makePage(overrides: Record<string, unknown> = {}) {
  return {
    $: vi.fn().mockResolvedValue(null),
    locator: vi.fn().mockReturnValue({
      first: vi.fn().mockReturnThis(),
      isVisible: vi.fn().mockResolvedValue(false),
      click: vi.fn().mockResolvedValue(undefined),
    }),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue(null),
    frames: vi.fn().mockReturnValue([]),
    ...overrides,
  } as unknown as ConsentPage;
}

function makeClickableLocator() {
  return {
    first: vi.fn().mockReturnThis(),
    isVisible: vi.fn().mockResolvedValue(true),
    click: vi.fn().mockResolvedValue(undefined),
  };
}

describe('dismissCookieConsent', () => {
  it('returns found: false when no banner is present', async () => {
    const page = makePage();
    const result = await dismissCookieConsent(page);
    expect(result.found).toBe(false);
    expect(result.strategy).toBeNull();
    expect(typeof result.durationMs).toBe('number');
  });

  it('detects and clicks Cookiebot banner', async () => {
    const locator = makeClickableLocator();
    const page = makePage({
      locator: vi.fn((selector: string) =>
        selector === '#CybotCookiebotDialogBodyButtonAccept'
          ? locator
          : {
              first: vi.fn().mockReturnThis(),
              isVisible: vi.fn().mockResolvedValue(false),
              click: vi.fn(),
            },
      ),
    });
    const result = await dismissCookieConsent(page);
    expect(result.found).toBe(true);
    expect(result.strategy).toBe('cookiebot');
    expect(locator.click).toHaveBeenCalledOnce();
  });

  it('detects and clicks OneTrust banner', async () => {
    const locator = makeClickableLocator();
    const page = makePage({
      locator: vi.fn((selector: string) =>
        selector === '#onetrust-accept-btn-handler'
          ? locator
          : {
              first: vi.fn().mockReturnThis(),
              isVisible: vi.fn().mockResolvedValue(false),
              click: vi.fn(),
            },
      ),
    });
    const result = await dismissCookieConsent(page);
    expect(result.found).toBe(true);
    expect(result.strategy).toBe('onetrust');
  });

  it('detects generic accept button by text', async () => {
    // First three locator chains (cookiebot, onetrust, trustarc) return invisible;
    // later calls hit generic selector and return visible.
    let callCount = 0;
    const genericLocator = makeClickableLocator();
    const page = makePage({
      locator: vi.fn(() => {
        callCount++;
        if (callCount <= 3) {
          return {
            first: vi.fn().mockReturnThis(),
            isVisible: vi.fn().mockResolvedValue(false),
            click: vi.fn(),
          };
        }
        return genericLocator;
      }),
    });

    const result = await dismissCookieConsent(page);
    expect(result.found).toBe(true);
    expect(result.strategy).toBe('generic');
  });

  it('waits after clicking to allow CMP to settle', async () => {
    const locator = makeClickableLocator();
    const page = makePage({
      locator: vi.fn((selector: string) =>
        selector === '#CybotCookiebotDialogBodyButtonAccept'
          ? locator
          : {
              first: vi.fn().mockReturnThis(),
              isVisible: vi.fn().mockResolvedValue(false),
              click: vi.fn(),
            },
      ),
    });
    await dismissCookieConsent(page);
    expect(page.waitForTimeout).toHaveBeenCalledOnce();
    const ms = (page.waitForTimeout as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(ms).toBeGreaterThanOrEqual(500);
    expect(ms).toBeLessThanOrEqual(1000);
  });

  it('always returns durationMs', async () => {
    const page = makePage();
    const result = await dismissCookieConsent(page);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});

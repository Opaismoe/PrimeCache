import { and, eq, sql } from 'drizzle-orm';
import type { Db } from '../client';
import { group_crawled_urls } from '../schema';

export interface CrawledUrl {
  url: string;
  firstDiscoveredAt: string;
}

export async function upsertCrawledUrl(db: Db, groupName: string, url: string): Promise<void> {
  await db
    .insert(group_crawled_urls)
    .values({ group_name: groupName, url, first_discovered_at: new Date() })
    .onConflictDoNothing();
}

export async function getGroupCrawledUrls(db: Db, groupName: string): Promise<CrawledUrl[]> {
  const rows = await db
    .select()
    .from(group_crawled_urls)
    .where(eq(group_crawled_urls.group_name, groupName))
    .orderBy(group_crawled_urls.first_discovered_at);

  return rows.map((r) => ({
    url: r.url,
    firstDiscoveredAt: r.first_discovered_at.toISOString(),
  }));
}

export async function deleteGroupCrawledUrl(
  db: Db,
  groupName: string,
  url: string,
): Promise<void> {
  await db
    .delete(group_crawled_urls)
    .where(and(eq(group_crawled_urls.group_name, groupName), eq(group_crawled_urls.url, url)));
}

export async function deleteAllGroupCrawledUrls(db: Db, groupName: string): Promise<void> {
  await db
    .delete(group_crawled_urls)
    .where(eq(group_crawled_urls.group_name, groupName));
}

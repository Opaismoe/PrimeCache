import { sql } from 'drizzle-orm';
import type { BrokenLink } from '../../warmer/visitor';
import type { Db } from '../client';
import { visit_broken_links } from '../schema';
import { sqlExecuteRows } from '../sqlExecuteRows';

export async function insertVisitBrokenLinks(
  db: Db,
  visitId: number,
  links: BrokenLink[],
): Promise<void> {
  if (links.length === 0) return;
  await db.insert(visit_broken_links).values(
    links.map((l) => ({
      visit_id: visitId,
      url: l.url,
      status_code: l.statusCode,
      error: l.error,
    })),
  );
}

export interface BrokenLinkSummary {
  url: string;
  statusCode: number | null;
  error: string | null;
  occurrences: number;
  lastSeenAt: string;
}

export async function getGroupBrokenLinks(db: Db, groupName: string): Promise<BrokenLinkSummary[]> {
  const rows = await db.execute(sql`
    SELECT
      bl.url,
      bl.status_code,
      bl.error,
      COUNT(*)::int              AS occurrences,
      MAX(v.visited_at)::text    AS last_seen_at
    FROM visit_broken_links bl
    JOIN visits v ON v.id = bl.visit_id
    JOIN runs r   ON r.id = v.run_id
    WHERE r.group_name = ${groupName}
      AND r.status != 'cancelled'
    GROUP BY bl.url, bl.status_code, bl.error
    ORDER BY occurrences DESC, bl.url
  `);
  return sqlExecuteRows(rows).map((r) => ({
    url: r.url as string,
    statusCode: r.status_code as number | null,
    error: r.error as string | null,
    occurrences: r.occurrences as number,
    lastSeenAt: r.last_seen_at as string,
  }));
}

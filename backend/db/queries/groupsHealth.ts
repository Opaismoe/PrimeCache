import { sql } from 'drizzle-orm';
import type { Db } from '../client';
import { sqlExecuteRows } from '../sqlExecuteRows';

export interface GroupHealthSummary {
  name: string;
  tabs: {
    performance: boolean;
    uptime: boolean;
    seo: boolean;
    links: boolean;
    accessibility: boolean;
  };
}

export async function getGroupsHealth(db: Db): Promise<GroupHealthSummary[]> {
  const [allGroupsRows, perfRows, uptimeRows, seoRows, linksRows, accessibilityRows] =
    await Promise.all([
      db.execute(sql`
        SELECT DISTINCT group_name FROM runs WHERE status != 'cancelled'
      `),
      db.execute(sql`
        SELECT DISTINCT r.group_name
        FROM visits v
        INNER JOIN runs r ON v.run_id = r.id
        WHERE r.status != 'cancelled'
        GROUP BY r.group_name, v.url
        HAVING PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY v.load_time_ms) > 3000
      `),
      db.execute(sql`
        SELECT DISTINCT r.group_name
        FROM visits v
        INNER JOIN runs r ON v.run_id = r.id
        WHERE r.status != 'cancelled'
          AND r.id IN (
            SELECT DISTINCT ON (group_name) id
            FROM runs
            WHERE status != 'cancelled'
            ORDER BY group_name, started_at DESC
          )
          AND (v.error IS NOT NULL OR v.status_code < 200 OR v.status_code >= 400)
      `),
      db.execute(sql`
        SELECT DISTINCT r.group_name
        FROM visit_seo vs
        INNER JOIN visits v ON vs.visit_id = v.id
        INNER JOIN runs r ON v.run_id = r.id
        WHERE r.status != 'cancelled'
          AND (vs.title IS NULL OR vs.meta_description IS NULL OR vs.h1 IS NULL)
      `),
      db.execute(sql`
        SELECT DISTINCT r.group_name
        FROM visit_broken_links vbl
        INNER JOIN visits v ON vbl.visit_id = v.id
        INNER JOIN runs r ON v.run_id = r.id
        WHERE r.status != 'cancelled'
      `),
      db.execute(sql`
        SELECT DISTINCT r.group_name
        FROM visit_accessibility va
        INNER JOIN visits v ON va.visit_id = v.id
        INNER JOIN runs r ON v.run_id = r.id
        WHERE r.status != 'cancelled'
          AND (va.critical_count > 0 OR va.serious_count > 0)
      `),
    ]);

  const toSet = (rows: unknown): Set<string> =>
    new Set(sqlExecuteRows(rows).map((row) => row.group_name as string));

  const allGroups = sqlExecuteRows(allGroupsRows).map((row) => row.group_name as string);
  const perfIssues = toSet(perfRows);
  const uptimeIssues = toSet(uptimeRows);
  const seoIssues = toSet(seoRows);
  const linksIssues = toSet(linksRows);
  const accessibilityIssues = toSet(accessibilityRows);

  return allGroups.map((name) => ({
    name,
    tabs: {
      performance: perfIssues.has(name),
      uptime: uptimeIssues.has(name),
      seo: seoIssues.has(name),
      links: linksIssues.has(name),
      accessibility: accessibilityIssues.has(name),
    },
  }));
}

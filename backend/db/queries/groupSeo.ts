import { sql } from 'drizzle-orm'
import type { Db } from '../client'
import type { SeoData } from './visitSeo'

export interface SeoScore {
  score: number       // 0–100
  issues: string[]
}

export interface UrlSeoHistory {
  visitId: number
  runId: number
  visitedAt: string
  seo: SeoData
}

export interface UrlSeoSummary {
  url: string
  latestSeo: SeoData | null
  score: number
  issues: string[]
  changed: boolean
  history: UrlSeoHistory[]
}

export interface GroupSeo {
  urls: UrlSeoSummary[]
}

function scoreSeo(seo: SeoData): SeoScore {
  const issues: string[] = []
  let score = 0

  // Title — 20pts
  if (!seo.title) {
    issues.push('Missing page title')
  } else if (seo.title.length < 10) {
    issues.push(`Title too short (${seo.title.length} chars, min 10)`)
    score += 10
  } else if (seo.title.length > 60) {
    issues.push(`Title too long (${seo.title.length} chars, max 60)`)
    score += 10
  } else {
    score += 20
  }

  // Meta description — 20pts
  if (!seo.metaDescription) {
    issues.push('Missing meta description')
  } else if (seo.metaDescription.length < 50) {
    issues.push(`Meta description too short (${seo.metaDescription.length} chars, min 50)`)
    score += 10
  } else if (seo.metaDescription.length > 160) {
    issues.push(`Meta description too long (${seo.metaDescription.length} chars, max 160)`)
    score += 10
  } else {
    score += 20
  }

  // H1 — 20pts
  if (!seo.h1) {
    issues.push('Missing H1 heading')
  } else {
    score += 20
  }

  // Canonical — 15pts
  if (!seo.canonicalUrl) {
    issues.push('Missing canonical URL')
  } else {
    score += 15
  }

  // OG tags — 15pts
  if (!seo.ogTitle && !seo.ogDescription) {
    issues.push('Missing Open Graph tags (og:title, og:description)')
  } else if (!seo.ogTitle) {
    issues.push('Missing og:title')
    score += 7
  } else if (!seo.ogDescription) {
    issues.push('Missing og:description')
    score += 7
  } else {
    score += 15
  }

  // Robots — 10pts
  if (seo.robotsMeta && /noindex/i.test(seo.robotsMeta)) {
    issues.push(`Page is set to noindex (robots: "${seo.robotsMeta}")`)
  } else {
    score += 10
  }

  return { score, issues }
}

function seoChanged(a: SeoData, b: SeoData): boolean {
  return (
    a.title !== b.title ||
    a.metaDescription !== b.metaDescription ||
    a.h1 !== b.h1 ||
    a.canonicalUrl !== b.canonicalUrl
  )
}

export async function getGroupSeo(db: Db, groupName: string): Promise<GroupSeo> {
  // Fetch last 5 seo rows per URL for this group (newest first)
  const rows = await db.execute(sql`
    SELECT
      v.url,
      v.id AS visit_id,
      v.run_id,
      v.visited_at,
      s.title,
      s.meta_description,
      s.h1,
      s.canonical_url,
      s.og_title,
      s.og_description,
      s.og_image,
      s.robots_meta
    FROM visits v
    INNER JOIN runs r ON v.run_id = r.id
    INNER JOIN visit_seo s ON s.visit_id = v.id
    WHERE r.group_name = ${groupName}
    ORDER BY v.url, v.visited_at DESC
  `)

  // Group by URL
  const byUrl = new Map<string, UrlSeoHistory[]>()
  for (const row of rows as any[]) {
    const url = row.url as string
    if (!byUrl.has(url)) byUrl.set(url, [])
    const history = byUrl.get(url)!
    if (history.length < 5) {
      history.push({
        visitId:   Number(row.visit_id),
        runId:     Number(row.run_id),
        visitedAt: (row.visited_at as Date).toISOString(),
        seo: {
          title:           row.title,
          metaDescription: row.meta_description,
          h1:              row.h1,
          canonicalUrl:    row.canonical_url,
          ogTitle:         row.og_title,
          ogDescription:   row.og_description,
          ogImage:         row.og_image,
          robotsMeta:      row.robots_meta,
        },
      })
    }
  }

  const urls: UrlSeoSummary[] = [...byUrl.entries()].map(([url, history]) => {
    const latestSeo = history[0]?.seo ?? null
    const { score, issues } = latestSeo ? scoreSeo(latestSeo) : { score: 0, issues: ['No SEO data collected yet'] }
    const changed = history.length >= 2 && latestSeo != null
      ? seoChanged(latestSeo, history[1].seo)
      : false

    return { url, latestSeo, score, issues, changed, history }
  })

  // Sort by score ascending (worst first)
  urls.sort((a, b) => a.score - b.score)

  return { urls }
}

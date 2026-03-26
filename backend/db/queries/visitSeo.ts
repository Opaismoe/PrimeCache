import { eq } from 'drizzle-orm'
import { visit_seo } from '../schema'
import type { Db } from '../client'

export interface SeoData {
  title: string | null
  metaDescription: string | null
  h1: string | null
  canonicalUrl: string | null
  ogTitle: string | null
  ogDescription: string | null
  ogImage: string | null
  robotsMeta: string | null
}

export async function insertVisitSeo(
  db: Db,
  visitId: number,
  seo: SeoData,
): Promise<void> {
  await db.insert(visit_seo).values({
    visit_id:         visitId,
    title:            seo.title,
    meta_description: seo.metaDescription,
    h1:               seo.h1,
    canonical_url:    seo.canonicalUrl,
    og_title:         seo.ogTitle,
    og_description:   seo.ogDescription,
    og_image:         seo.ogImage,
    robots_meta:      seo.robotsMeta,
    collected_at:     new Date(),
  })
}

export async function getVisitSeoByVisitId(
  db: Db,
  visitId: number,
): Promise<SeoData | null> {
  const [row] = await db
    .select()
    .from(visit_seo)
    .where(eq(visit_seo.visit_id, visitId))
    .limit(1)
  if (!row) return null
  return {
    title:            row.title,
    metaDescription:  row.meta_description,
    h1:               row.h1,
    canonicalUrl:     row.canonical_url,
    ogTitle:          row.og_title,
    ogDescription:    row.og_description,
    ogImage:          row.og_image,
    robotsMeta:       row.robots_meta,
  }
}

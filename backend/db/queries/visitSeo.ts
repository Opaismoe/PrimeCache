import { eq } from 'drizzle-orm';
import type { Db } from '../client';
import { visit_seo } from '../schema';

export interface SeoData {
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  h2: string | null;
  h3: string | null;
  h4: string | null;
  h5: string | null;
  canonicalUrl: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  robotsMeta: string | null;
  viewportMeta: string | null;
  lang: string | null;
}

export async function insertVisitSeo(db: Db, visitId: number, seo: SeoData): Promise<void> {
  await db.insert(visit_seo).values({
    visit_id: visitId,
    title: seo.title,
    meta_description: seo.metaDescription,
    h1: seo.h1,
    h2: seo.h2,
    h3: seo.h3,
    h4: seo.h4,
    h5: seo.h5,
    canonical_url: seo.canonicalUrl,
    og_title: seo.ogTitle,
    og_description: seo.ogDescription,
    og_image: seo.ogImage,
    robots_meta: seo.robotsMeta,
    viewport_meta: seo.viewportMeta,
    lang: seo.lang,
    collected_at: new Date(),
  });
}

export async function getVisitSeoByVisitId(db: Db, visitId: number): Promise<SeoData | null> {
  const [row] = await db.select().from(visit_seo).where(eq(visit_seo.visit_id, visitId)).limit(1);
  if (!row) return null;
  return {
    title: row.title,
    metaDescription: row.meta_description,
    h1: row.h1,
    h2: row.h2,
    h3: row.h3,
    h4: row.h4,
    h5: row.h5,
    canonicalUrl: row.canonical_url,
    ogTitle: row.og_title,
    ogDescription: row.og_description,
    ogImage: row.og_image,
    robotsMeta: row.robots_meta,
    viewportMeta: row.viewport_meta,
    lang: row.lang,
  };
}

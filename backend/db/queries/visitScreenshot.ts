import { asc, eq } from 'drizzle-orm';
import type { Db } from '../client';
import { visit_screenshots, visits } from '../schema';

export interface VisitScreenshotRow {
  visitId: number;
  url: string;
  imageData: string;
  capturedAt: Date;
}

export async function insertVisitScreenshot(
  db: Db,
  visitId: number,
  imageBase64: string,
): Promise<void> {
  await db.insert(visit_screenshots).values({
    visit_id: visitId,
    image_data: imageBase64,
    captured_at: new Date(),
  });
}

export async function getScreenshotsByRunId(db: Db, runId: number): Promise<VisitScreenshotRow[]> {
  return db
    .select({
      visitId: visit_screenshots.visit_id,
      url: visits.url,
      imageData: visit_screenshots.image_data,
      capturedAt: visit_screenshots.captured_at,
    })
    .from(visit_screenshots)
    .innerJoin(visits, eq(visits.id, visit_screenshots.visit_id))
    .where(eq(visits.run_id, runId))
    .orderBy(asc(visits.visited_at));
}

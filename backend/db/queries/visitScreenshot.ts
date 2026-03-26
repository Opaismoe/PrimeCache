import { visit_screenshots } from '../schema'
import type { Db } from '../client'

export async function insertVisitScreenshot(
  db: Db,
  visitId: number,
  imageBase64: string,
): Promise<void> {
  await db.insert(visit_screenshots).values({
    visit_id:    visitId,
    image_data:  imageBase64,
    captured_at: new Date(),
  })
}

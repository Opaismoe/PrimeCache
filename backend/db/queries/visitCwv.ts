import { visit_cwv } from '../schema'
import type { Db } from '../client'
import type { CwvSnapshot } from '../../warmer/visitor'

export async function insertVisitCwv(
  db: Db,
  visitId: number,
  cwv: CwvSnapshot,
): Promise<void> {
  await db.insert(visit_cwv).values({
    visit_id:  visitId,
    lcp_ms:    cwv.lcpMs,
    cls_score: cwv.clsScore,
    inp_ms:    cwv.inpMs,
    fcp_ms:    cwv.fcpMs,
  })
}

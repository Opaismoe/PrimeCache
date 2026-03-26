import { visit_headers } from '../schema'
import type { Db } from '../client'
import type { HeadersSnapshot } from '../../warmer/visitor'

export async function insertVisitHeaders(
  db: Db,
  visitId: number,
  h: HeadersSnapshot,
): Promise<void> {
  await db.insert(visit_headers).values({
    visit_id:                  visitId,
    cache_control:             h.cacheControl,
    x_cache:                   h.xCache,
    cf_cache_status:           h.cfCacheStatus,
    age:                       h.age,
    etag:                      h.etag,
    content_type:              h.contentType,
    x_frame_options:           h.xFrameOptions,
    x_content_type_options:    h.xContentTypeOptions,
    strict_transport_security: h.strictTransportSecurity,
    content_security_policy:   h.contentSecurityPolicy,
  })
}

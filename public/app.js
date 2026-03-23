// ── State ─────────────────────────────────────────────────────────────────────
let apiKey = localStorage.getItem('apiKey') || ''
let historyOffset = 0
let historyLimit = 20
let historyGroup = ''

// ── Toast ──────────────────────────────────────────────────────────────────────
const toastEl = document.createElement('div')
toastEl.id = 'toast'
document.body.appendChild(toastEl)

let toastTimer = null
function toast(msg, type = 'success') {
  toastEl.textContent = msg
  toastEl.className = `show ${type}`
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastEl.className = '' }, 3200)
}

// ── API helper ─────────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
  }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(path, opts)
  if (res.status === 401) { showModal(); return null }
  return res
}

// ── Modal ──────────────────────────────────────────────────────────────────────
const modalOverlay = document.getElementById('modal-overlay')
const apiKeyInput = document.getElementById('api-key-input')
const apiKeySubmit = document.getElementById('api-key-submit')
const apiKeyError = document.getElementById('api-key-error')

function showModal() {
  modalOverlay.classList.remove('hidden')
  apiKeyInput.value = ''
  apiKeyError.classList.add('hidden')
  setTimeout(() => apiKeyInput.focus(), 50)
}

async function tryConnect() {
  const key = apiKeyInput.value.trim()
  if (!key) return
  const tmpKey = apiKey
  apiKey = key
  const res = await fetch('/config', { headers: { 'X-API-Key': key } })
  if (res.status === 401) {
    apiKey = tmpKey
    apiKeyError.classList.remove('hidden')
    return
  }
  localStorage.setItem('apiKey', key)
  modalOverlay.classList.add('hidden')
  route()
}

apiKeySubmit.addEventListener('click', tryConnect)
apiKeyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryConnect() })

// ── Router ─────────────────────────────────────────────────────────────────────
const views = {
  dashboard:  document.getElementById('view-dashboard'),
  history:    document.getElementById('view-history'),
  'run-detail': document.getElementById('view-run-detail'),
  config:     document.getElementById('view-config'),
}

function showView(name) {
  for (const [k, el] of Object.entries(views)) {
    el.classList.toggle('hidden', k !== name)
  }
  document.querySelectorAll('nav a').forEach((a) => {
    const href = a.getAttribute('href').replace('#', '')
    a.classList.toggle('active', href === name)
  })
}

function route() {
  const hash = location.hash.replace('#', '') || 'dashboard'
  if (hash.startsWith('run-detail/')) {
    const id = hash.split('/')[1]
    renderRunDetail(id)
    return
  }
  const view = views[hash] ? hash : 'dashboard'
  showView(view)
  if (view === 'dashboard') renderDashboard()
  else if (view === 'history') renderHistory()
  else if (view === 'config') renderConfig()
}

window.addEventListener('hashchange', route)

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('nl-NL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function statusBadge(status) {
  return `<span data-status="${status}">${status ?? 'unknown'}</span>`
}

function ms(val) {
  if (val == null) return '—'
  if (val >= 1000) return (val / 1000).toFixed(2) + 's'
  return val + 'ms'
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
async function renderDashboard() {
  const view = views.dashboard
  view.innerHTML = `<div class="view-header"><h1>Dashboard</h1></div><div class="cards" id="dash-cards"><p class="empty">Loading…</p></div>`

  const [runsRes, cfgRes] = await Promise.all([
    api('GET', '/runs/latest'),
    api('GET', '/config'),
  ])
  if (!runsRes || !cfgRes) return

  const latestRuns = await runsRes.json()   // array of latest run per group
  const { groups } = await cfgRes.json()

  const byGroup = {}
  for (const r of latestRuns) byGroup[r.group_name] = r

  const cards = document.getElementById('dash-cards')
  if (!groups.length) {
    cards.innerHTML = '<p class="empty">No groups configured.</p>'
    return
  }

  cards.innerHTML = groups.map((g) => {
    const run = byGroup[g.name]
    const status = run?.status ?? 'never'
    const started = run ? fmt(run.started_at) : '—'
    return `
      <div class="card">
        <div class="card-title">${esc(g.name)}</div>
        <div class="card-meta">Schedule: ${esc(g.schedule)}</div>
        <div class="card-meta">${g.urls.length} URL${g.urls.length !== 1 ? 's' : ''}</div>
        <div class="card-meta">Last run: ${started}</div>
        <div class="card-footer">
          ${run ? statusBadge(status) : '<span data-status="pending">Never run</span>'}
          <button class="btn btn-sm" data-trigger="${esc(g.name)}">Run now</button>
        </div>
        ${run ? `<a href="#run-detail/${run.id}" style="font-size:0.8rem;color:var(--text-muted)">View last run →</a>` : ''}
      </div>`
  }).join('')

  cards.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-trigger]')
    if (!btn) return
    const groupName = btn.dataset.trigger
    btn.disabled = true
    btn.textContent = 'Running…'
    const res = await api('POST', '/trigger', { group: groupName })
    if (!res) return
    if (res.ok) {
      const { runId } = await res.json()
      toast(`Run complete (ID ${runId})`, 'success')
      location.hash = `#run-detail/${runId}`
    } else {
      const body = await res.json()
      toast(body.error || 'Trigger failed', 'fail')
      btn.disabled = false
      btn.textContent = 'Run now'
    }
  })
}

// ── History ────────────────────────────────────────────────────────────────────
async function renderHistory(offset = 0, group = historyGroup) {
  historyOffset = offset
  historyGroup = group

  const view = views.history
  view.innerHTML = `<div class="view-header"><h1>Run History</h1></div><p class="empty">Loading…</p>`

  // Fetch groups for filter
  const cfgRes = await api('GET', '/config')
  if (!cfgRes) return
  const { groups } = await cfgRes.json()

  const params = new URLSearchParams({ limit: historyLimit, offset })
  const runsRes = await api('GET', `/runs?${params}`)
  if (!runsRes) return
  const runs = await runsRes.json()

  view.innerHTML = `
    <div class="view-header"><h1>Run History</h1></div>
    <div class="filter-bar">
      <select id="hist-group-filter">
        <option value="">All groups</option>
        ${groups.map((g) => `<option value="${esc(g.name)}" ${g.name === group ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}
      </select>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>ID</th><th>Group</th><th>Status</th><th>Started</th><th>Duration</th>
        </tr></thead>
        <tbody id="hist-tbody"></tbody>
      </table>
    </div>
    <div class="pagination">
      <button class="btn btn-sm btn-ghost" id="hist-prev" ${offset === 0 ? 'disabled' : ''}>← Prev</button>
      <span>Showing ${offset + 1}–${offset + runs.length}</span>
      <button class="btn btn-sm btn-ghost" id="hist-next" ${runs.length < historyLimit ? 'disabled' : ''}>Next →</button>
    </div>`

  const tbody = document.getElementById('hist-tbody')
  const filtered = group ? runs.filter((r) => r.group_name === group) : runs

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">No runs found.</td></tr>`
  } else {
    tbody.innerHTML = filtered.map((r) => {
      const dur = r.finished_at && r.started_at
        ? ms(new Date(r.finished_at) - new Date(r.started_at))
        : '—'
      return `<tr class="row-link" data-run="${r.id}">
        <td>#${r.id}</td>
        <td>${esc(r.group_name)}</td>
        <td>${statusBadge(r.status)}</td>
        <td>${fmt(r.started_at)}</td>
        <td>${dur}</td>
      </tr>`
    }).join('')
  }

  tbody.addEventListener('click', (e) => {
    const row = e.target.closest('[data-run]')
    if (row) location.hash = `#run-detail/${row.dataset.run}`
  })

  document.getElementById('hist-group-filter').addEventListener('change', (e) => {
    renderHistory(0, e.target.value)
  })

  document.getElementById('hist-prev').addEventListener('click', () => renderHistory(Math.max(0, offset - historyLimit), group))
  document.getElementById('hist-next').addEventListener('click', () => renderHistory(offset + historyLimit, group))
}

// ── Run detail ─────────────────────────────────────────────────────────────────
async function renderRunDetail(id) {
  showView('run-detail')
  const view = views['run-detail']
  view.innerHTML = `<a href="#history" class="back-link">← Back to History</a><p class="empty">Loading…</p>`

  const res = await api('GET', `/runs/${id}`)
  if (!res) return
  if (!res.ok) {
    view.innerHTML = `<a href="#history" class="back-link">← Back to History</a><p class="empty">Run not found.</p>`
    return
  }
  const run = await res.json()
  const visits = run.visits ?? []

  const dur = run.finished_at && run.started_at
    ? ms(new Date(run.finished_at) - new Date(run.started_at))
    : '—'

  const totalVisits = visits.length
  const failedVisits = visits.filter((v) => v.error).length
  const avgTtfb = visits.filter((v) => v.ttfb_ms != null).reduce((a, v, _, arr) => a + v.ttfb_ms / arr.length, 0)

  view.innerHTML = `
    <a href="#history" class="back-link">← Back to History</a>
    <div class="view-header">
      <h1>Run #${run.id} — ${esc(run.group_name)}</h1>
      ${statusBadge(run.status)}
    </div>
    <div class="metrics-row">
      <div class="metric-card"><div class="metric-label">Started</div><div class="metric-value" style="font-size:0.95rem">${fmt(run.started_at)}</div></div>
      <div class="metric-card"><div class="metric-label">Duration</div><div class="metric-value">${dur}</div></div>
      <div class="metric-card"><div class="metric-label">URLs visited</div><div class="metric-value">${totalVisits}</div></div>
      <div class="metric-card"><div class="metric-label">Errors</div><div class="metric-value" style="color:${failedVisits ? 'var(--red)' : 'var(--green)'}">${failedVisits}</div></div>
      ${totalVisits ? `<div class="metric-card"><div class="metric-label">Avg TTFB</div><div class="metric-value">${ms(Math.round(avgTtfb))}</div></div>` : ''}
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>#</th><th>URL</th><th>Status</th><th>TTFB</th><th>Load</th><th>Error</th>
        </tr></thead>
        <tbody>
          ${visits.length ? visits.map((v, i) => `
            <tr class="${v.error ? 'row-error' : ''}">
              <td>${i + 1}</td>
              <td style="word-break:break-all;max-width:320px">${esc(v.url)}</td>
              <td>${v.http_status ?? '—'}</td>
              <td>${ms(v.ttfb_ms)}</td>
              <td>${ms(v.load_ms)}</td>
              <td>${v.error ? `<span class="error-msg">${esc(v.error)}</span>` : '—'}</td>
            </tr>`).join('')
            : `<tr><td colspan="6" class="empty">No visits recorded.</td></tr>`}
        </tbody>
      </table>
    </div>`
}

// ── Config ─────────────────────────────────────────────────────────────────────
let configGroups = []
let editingIndex = -1  // -1 = add new

async function renderConfig() {
  const view = views.config
  view.innerHTML = `<div class="view-header"><h1>Config</h1></div><p class="empty">Loading…</p>`

  const res = await api('GET', '/config')
  if (!res) return
  const { groups } = await res.json()
  configGroups = groups
  renderConfigList()
}

function renderConfigList() {
  editingIndex = -1
  const view = views.config
  view.innerHTML = `
    <div class="view-header">
      <h1>Config</h1>
      <button class="btn" id="btn-add-group">+ Add group</button>
    </div>
    <div class="config-group-list" id="group-list">
      ${configGroups.length ? configGroups.map((g, i) => `
        <div class="config-group-item">
          <div class="config-group-info">
            <strong>${esc(g.name)}</strong>
            <span>${esc(g.schedule)} · ${g.urls.length} URL${g.urls.length !== 1 ? 's' : ''}</span>
          </div>
          <div class="config-group-actions">
            <button class="btn btn-sm btn-ghost" data-edit="${i}">Edit</button>
            <button class="btn btn-sm btn-danger" data-delete="${i}">Delete</button>
          </div>
        </div>`).join('')
        : '<p class="empty">No groups configured yet.</p>'}
    </div>`

  document.getElementById('btn-add-group').addEventListener('click', () => renderGroupForm(null, -1))

  document.getElementById('group-list').addEventListener('click', async (e) => {
    const editBtn = e.target.closest('[data-edit]')
    const delBtn = e.target.closest('[data-delete]')
    if (editBtn) {
      const i = Number(editBtn.dataset.edit)
      renderGroupForm(configGroups[i], i)
    }
    if (delBtn) {
      const i = Number(delBtn.dataset.delete)
      if (!confirm(`Delete group "${configGroups[i].name}"?`)) return
      configGroups.splice(i, 1)
      const ok = await saveConfig()
      if (ok) { toast('Group deleted', 'success'); renderConfigList() }
    }
  })
}

function renderGroupForm(group, index) {
  editingIndex = index
  const isNew = index === -1
  const g = group ?? { name: '', schedule: '', urls: [], options: { scrollToBottom: false, crawl: false } }
  const opts = g.options ?? {}

  const view = views.config
  view.innerHTML = `
    <div class="view-header">
      <h1>${isNew ? 'Add group' : `Edit "${esc(g.name)}"`}</h1>
    </div>
    <div class="form-panel">
      <div class="form-grid">
        <div class="form-field">
          <label for="f-name">Name *</label>
          <input type="text" id="f-name" value="${esc(g.name)}" placeholder="homepage">
        </div>
        <div class="form-field">
          <label for="f-schedule">Schedule (cron) *</label>
          <input type="text" id="f-schedule" value="${esc(g.schedule)}" placeholder="*/15 * * * *">
        </div>
        <div class="form-field full">
          <label for="f-urls">URLs * <span style="font-weight:400">(one per line)</span></label>
          <textarea id="f-urls" rows="5" placeholder="https://example.com/">${esc(g.urls.join('\n'))}</textarea>
        </div>
        <div class="form-field">
          <label>Options</label>
          <div class="checkbox-row">
            <input type="checkbox" id="f-scroll" ${opts.scrollToBottom ? 'checked' : ''}>
            <label for="f-scroll">Scroll to bottom</label>
          </div>
          <div class="checkbox-row">
            <input type="checkbox" id="f-crawl" ${opts.crawl ? 'checked' : ''}>
            <label for="f-crawl">Crawl (BFS)</label>
          </div>
        </div>
        <div class="form-field" id="crawl-depth-field" ${!opts.crawl ? 'style="display:none"' : ''}>
          <label for="f-depth">Crawl depth (1–10) *</label>
          <input type="number" id="f-depth" min="1" max="10" value="${opts.crawl_depth ?? 2}">
        </div>
        <div class="form-field">
          <label for="f-selector">Wait for selector <span style="font-weight:400">(optional)</span></label>
          <input type="text" id="f-selector" value="${esc(opts.waitForSelector ?? '')}" placeholder="main">
        </div>
        <div class="form-field">
          <label for="f-ua">User agent <span style="font-weight:400">(optional)</span></label>
          <input type="text" id="f-ua" value="${esc(opts.userAgent ?? '')}" placeholder="MyBot/1.0">
        </div>
      </div>
      <div id="form-errors" style="margin-top:0.75rem"></div>
      <div class="form-actions">
        <button class="btn" id="btn-save-group">Save</button>
        <button class="btn btn-ghost" id="btn-cancel-group">Cancel</button>
      </div>
    </div>`

  document.getElementById('f-crawl').addEventListener('change', (e) => {
    document.getElementById('crawl-depth-field').style.display = e.target.checked ? '' : 'none'
  })

  document.getElementById('btn-cancel-group').addEventListener('click', renderConfigList)

  document.getElementById('btn-save-group').addEventListener('click', async () => {
    const name     = document.getElementById('f-name').value.trim()
    const schedule = document.getElementById('f-schedule').value.trim()
    const rawUrls  = document.getElementById('f-urls').value.trim()
    const urls     = rawUrls.split('\n').map((u) => u.trim()).filter(Boolean)
    const scrollToBottom = document.getElementById('f-scroll').checked
    const crawl    = document.getElementById('f-crawl').checked
    const selector = document.getElementById('f-selector').value.trim()
    const ua       = document.getElementById('f-ua').value.trim()

    const options = { scrollToBottom, crawl }
    if (crawl) options.crawl_depth = Number(document.getElementById('f-depth').value)
    if (selector) options.waitForSelector = selector
    if (ua) options.userAgent = ua

    const updated = { name, schedule, urls, options }

    if (isNew) {
      configGroups.push(updated)
    } else {
      configGroups[editingIndex] = updated
    }

    const ok = await saveConfig()
    if (ok) {
      toast(isNew ? 'Group added' : 'Group saved', 'success')
      renderConfigList()
    } else {
      if (isNew) configGroups.pop()
      else configGroups[editingIndex] = group
    }
  })
}

async function saveConfig() {
  const res = await api('PUT', '/config', { groups: configGroups })
  if (!res) return false
  if (res.ok) return true
  const body = await res.json()
  const errEl = document.getElementById('form-errors')
  if (errEl && body.issues) {
    errEl.innerHTML = body.issues.map((iss) =>
      `<p class="error">${esc(iss.message)}</p>`
    ).join('')
  } else {
    toast(body.error || 'Save failed', 'fail')
  }
  return false
}

// ── Escape helper ──────────────────────────────────────────────────────────────
function esc(str) {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Boot ───────────────────────────────────────────────────────────────────────
if (!apiKey) {
  showModal()
} else {
  // Verify stored key is still valid
  fetch('/config', { headers: { 'X-API-Key': apiKey } }).then((r) => {
    if (r.status === 401) { showModal() }
    else { route() }
  }).catch(() => { showModal() })
}

/* gym-log 서비스 워커 — 앱 셸 오프라인 지원
 * - 내비게이션: 네트워크 우선, 오프라인이면 캐시된 index.html (HashRouter라 모든 화면이 index.html)
 * - assets/ (Vite 해시 파일): 캐시 우선 + 런타임 캐싱
 * - 그 외 같은 출처 파일(manifest, 아이콘 등): stale-while-revalidate
 * 캐시를 강제로 비우려면 CACHE_VERSION을 올린다.
 */
const CACHE_PREFIX = 'gym-log-'
const CACHE_VERSION = 'v1'
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION

// SW 스코프 기준 경로 (GitHub Pages: /gym-log/)
const SCOPE = self.registration.scope
const INDEX_URL = new URL('./index.html', SCOPE).href
const ASSETS_PATH = new URL('./assets/', SCOPE).pathname

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()))
})

async function precache() {
  const cache = await caches.open(CACHE_NAME)
  // HTTP 캐시를 우회해 최신 앱 셸을 받아둔다
  await cache.addAll(['./', './index.html'].map((u) => new Request(u, { cache: 'reload' })))
  // index.html이 참조하는 해시 에셋(JS/CSS)도 미리 받아 첫 방문 직후에도 오프라인 동작
  const html = await (await cache.match('./index.html')).text()
  const assets = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)].map((m) => m[1])
  await cache.addAll(assets).catch(() => {}) // 실패해도 설치는 진행 (런타임 캐싱이 보완)
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      // 같은 github.io 출처의 다른 앱 캐시는 건드리지 않도록 접두사로 거른다
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  if (!request.url.startsWith(SCOPE)) return // 다른 출처 또는 스코프 밖 요청은 브라우저에 맡김
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return // DevTools 버그 회피

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(event))
  } else if (new URL(request.url).pathname.startsWith(ASSETS_PATH)) {
    event.respondWith(cacheFirst(event))
  } else {
    event.respondWith(staleWhileRevalidate(event))
  }
})

// 정상 응답(200번대, 같은 출처 basic)만 캐시한다 — opaque/에러 응답 제외
function isCacheable(res) {
  return res && res.ok && res.type === 'basic'
}

function putInCache(event, key, res) {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(key, res)))
}

// Vary 무시: <script type="module" crossorigin> 요청엔 Origin 헤더가 붙어
// 서버가 'Vary: Origin'을 주면 캐시가 빗나간다 (같은 출처 정적 파일만 캐시하므로 안전)
function fromCache(req) {
  return caches.match(req, { ignoreVary: true })
}

async function networkFirst(event) {
  try {
    const res = await fetch(event.request)
    // 모든 라우트가 같은 index.html이므로 최신 셸로 갱신
    if (isCacheable(res) && (res.headers.get('content-type') || '').includes('text/html')) {
      putInCache(event, INDEX_URL, res.clone())
    }
    return res
  } catch (err) {
    const cached = (await fromCache(INDEX_URL)) || (await fromCache(event.request))
    if (cached) return cached
    throw err
  }
}

async function cacheFirst(event) {
  const cached = await fromCache(event.request)
  if (cached) return cached
  const res = await fetch(event.request)
  if (isCacheable(res)) putInCache(event, event.request, res.clone())
  return res
}

async function staleWhileRevalidate(event) {
  const cached = await fromCache(event.request)
  const update = fetch(event.request).then((res) => {
    if (isCacheable(res)) putInCache(event, event.request, res.clone())
    return res
  })
  if (cached) {
    event.waitUntil(update.catch(() => {})) // 백그라운드 갱신 (오프라인이면 무시)
    return cached
  }
  return update
}

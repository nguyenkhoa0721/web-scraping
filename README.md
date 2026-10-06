# mozy-scrape

Web scraper and search aggregator. Turns web pages into clean Markdown for LLMs, and searches the web through several engines. Use it as a CLI or an HTTP API.

## Features

- Scrape one URL or many, with Markdown output
- Main-content extraction, or full-page mode
- Optional image/media URLs (`includeMedia`)
- Anti-detect browser with fingerprint rotation
- Ad and tracker blocking
- Browser context pooling and per-domain throttling
- Search with DuckDuckGo, Coccoc, Brave Lite (no key), and Brave API (needs key)
- Round-robin across engines, with automatic fallback on failure
- Optional proxy for search requests (`SEARCH_PROXY_URL`), except DuckDuckGo; scraping is not proxied

## CLI

There is no argument-parsing CLI. Use the scripts below, or import the library from `src/index.ts`.

```bash
bun run serve   # start the HTTP server on :3000
bun run dev     # start with hot reload
bun run check   # lint and type check
bun test        # unit tests
```

```ts
import { Scraper, DEFAULT_CONFIG } from "./src/index.ts";
```

## API

```bash
bun run serve   # starts on :3000
```

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check and stats |
| `POST` | `/scrape` | Scrape one URL |
| `POST` | `/scrape/batch` | Scrape up to 100 URLs |
| `POST` | `/scrape/stream` | Stream results over SSE |
| `POST` | `/search` | Search (JSON body) |
| `GET` | `/search` | Search (`?q=...&engine=...`) |
| `GET` | `/search/health` | Search engine health |

**Scrape body:** `url`, `urls`, `format`, `timeout`, `waitAfterLoad`, `extractMainContent`, `fullPage`, `includeMetadata`, `includeMedia`, `blockResources`

```bash
curl -X POST http://localhost:3000/scrape \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://example.com"}'
```

**Search body:** `query` (required), `engine` (optional; default is round-robin)

```bash
curl -X POST http://localhost:3000/search \
  -H 'Content-Type: application/json' \
  -d '{"query": "typescript web scraping", "engine": "duckduckgo"}'
```

**Env vars:** `PORT`, `HOST`, `CONCURRENCY`, `TIMEOUT`, `BRAVE_SEARCH_API_KEY`, `SEARCH_PROXY_URL`, `LOG_LEVEL`

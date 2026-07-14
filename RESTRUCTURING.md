# Project Restructuring Summary

## Architecture Overview

The project has been restructured from a flat structure to a modular architecture with two main modules: **scraper** and **search**, plus a **common** module for shared utilities.

```
src/
├── scraper/              # Web scraping module
│   ├── index.ts          # Module exports
│   ├── scraper.ts        # Main scraper logic
│   ├── browser-pool.ts   # Browser context pooling
│   ├── extractor.ts      # Content extraction (Defuddle)
│   ├── html-to-markdown.ts  # HTML to Markdown conversion
│   └── types.ts          # Scraper types
│
├── search/               # Search engine module
│   ├── index.ts          # Module exports
│   ├── types.ts          # Abstract SearchEngine base class
│   ├── registry.ts       # Round-robin registry with fallback
│   └── engines/          # Search engine implementations
│       ├── index.ts
│       ├── duckduckgo.ts # DuckDuckGo Lite
│       ├── brave.ts      # Brave Search (stub)
│       └── bing.ts       # Bing (stub)
│
├── common/               # Shared utilities
│   └── logger.ts         # Structured JSON logger
│
├── index.ts              # Main entry point (CLI + exports)
└── server.ts             # HTTP server
```

## Key Design Decisions

### 1. Abstract SearchEngine Base Class
```typescript
export abstract class SearchEngine {
  abstract readonly name: string;
  protected config: SearchConfig;
  
  abstract search(query: string): Promise<SearchResponse>;
  
  async isAvailable(): Promise<boolean> { ... }
}
```

All search engines extend this base class, ensuring a consistent interface.

### 2. SearchEngineRegistry with Round-Robin
- Maintains a list of registered engines
- `searchWithRoundRobin()` rotates through engines automatically
- Falls back to the next engine if one fails
- `getEngine(name)` for targeting a specific engine

### 3. Unified SearchResponse
```typescript
interface SearchResponse {
  query: string;
  results: SearchResult[];  // { title, url, snippet, rank }
  engine: string;
  duration: number;         // milliseconds
}
```

### 4. Extensibility
To add a new search engine:
1. Create `src/search/engines/myengine.ts`
2. Extend `SearchEngine` base class
3. Implement `search()` method
4. Register in `server.ts`: `searchRegistry.register(new MyEngine())`

## API Endpoints

### Search
- `POST /search` - JSON body: `{ query: string, engine?: string }`
- `GET /search?q=...&engine=...` - Query parameters
- Returns JSON with results array

### Scrape (unchanged)
- `POST /scrape` - Single URL
- `POST /scrape/batch` - Multiple URLs
- `POST /scrape/stream` - SSE stream

## Testing

Verified with live search:
```bash
curl "http://localhost:3000/search?q=c%E1%BB%95%20phi%E1%BA%BFu%20HPG"
```
Returns 10 results from DuckDuckGo with proper titles, URLs, and snippets.

## TypeScript Notes

- Pre-existing type errors from `linkedom` library (incompatible DOM types) are from the third-party package itself
- Bun runtime handles these correctly at runtime
- All project source code is properly typed
- `turndown-plugin-gfm` declaration file added for type safety

## How to Extend

### Adding a new search engine:

```typescript
// src/search/engines/google.ts
import { SearchEngine, type SearchConfig, type SearchResponse } from "../types.ts";
import { parseHTML } from "linkedom";

export class GoogleSearchEngine extends SearchEngine {
  readonly name = "google";
  
  constructor(config: SearchConfig = {}) {
    super(config);
  }
  
  async search(query: string): Promise<SearchResponse> {
    // ... implementation
  }
}
```

Then register in `server.ts`:
```typescript
import { GoogleSearchEngine } from "./search/engines/google.ts";
searchRegistry.register(new GoogleSearchEngine());
```

The round-robin will automatically include it in the rotation.

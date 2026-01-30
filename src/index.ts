#!/usr/bin/env bun

export { extractContent, extractFullPage } from "./extractor.ts";
export { htmlToMarkdown } from "./html-to-markdown.ts";
export { Scraper } from "./scraper.ts";
export type { PageMetadata, ScrapeConfig, ScrapeJob, ScrapeResult } from "./types.ts";
export { DEFAULT_CONFIG } from "./types.ts";

import { Scraper } from "./scraper.ts";
import type { ScrapeConfig, ScrapeResult } from "./types.ts";

// --- Helpers (must be before CLI block for TDZ) ---

/** Flags that take a value argument */
const VALUE_FLAGS = new Set(["c", "concurrency", "timeout", "wait", "output", "o"]);

function parseCLI(args: string[]): {
    flags: Record<string, string | boolean>;
    urls: string[];
} {
    const flags: Record<string, string | boolean> = {};
    const urls: string[] = [];

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (!arg) continue;
        if (arg.startsWith("--")) {
            const key = arg.slice(2);
            if (VALUE_FLAGS.has(key)) {
                flags[key] = args[++i] || "";
            } else {
                flags[key] = true;
            }
        } else if (arg.startsWith("-") && arg.length === 2) {
            const key = arg.slice(1);
            if (VALUE_FLAGS.has(key)) {
                flags[key] = args[++i] || "";
            } else {
                flags[key] = true;
            }
        } else {
            urls.push(arg);
        }
    }

    // Normalize short flags
    if (flags.c) {
        flags.concurrency = flags.c;
        delete flags.c;
    }
    if (flags.o) {
        flags.output = flags.o;
        delete flags.o;
    }

    return { flags, urls };
}

function ms(n: number): string {
    if (n < 1000) return `${Math.round(n)}ms`;
    return `${(n / 1000).toFixed(1)}s`;
}

function printUsage() {
    console.log(`
mozy-scrape - Convert websites to clean, LLM-ready markdown

USAGE
  bun run src/index.ts [options] <url...>

EXAMPLES
  bun run src/index.ts https://example.com
  bun run src/index.ts --json https://example.com
  bun run src/index.ts --output result.md https://example.com
  bun run src/index.ts -c 10 url1 url2 url3
  bun run src/index.ts --full-page https://example.com

OPTIONS
  -c, --concurrency <n>   Max concurrent browser contexts (default: 5)
  --timeout <ms>           Navigation timeout in ms (default: 30000)
  --wait <ms>              Extra wait after page load (default: 0)
  --output <file>          Write output to file (batch: appends -N)
  --json                   Output as JSON with metadata & timing
  --full-page              Don't use Readability, get full page
  --no-readability         Same as --full-page
  --no-metadata            Skip metadata header in markdown output
  --no-block               Don't block images/fonts/css (slower)
  -h, --help               Show this help
`);
}

// --- CLI ---
if (import.meta.main) {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
        printUsage();
        process.exit(0);
    }

    const { flags, urls } = parseCLI(args);

    if (urls.length === 0) {
        console.error("Error: No URLs provided.\n");
        printUsage();
        process.exit(1);
    }

    const config: Partial<ScrapeConfig> = {};
    if (flags.concurrency) config.concurrency = Number(flags.concurrency);
    if (flags.timeout) config.timeout = Number(flags.timeout);
    if (flags["no-readability"]) config.extractMainContent = false;
    if (flags["no-metadata"]) config.includeMetadata = false;
    if (flags["no-block"]) config.blockResources = false;
    if (flags.wait) config.waitAfterLoad = Number(flags.wait);
    if (flags["full-page"]) config.extractMainContent = false;

    const scraper = new Scraper(config);
    const output = flags.output as string | undefined;
    const jsonMode = flags.json === true;

    try {
        if (urls.length === 1) {
            const result = await scraper.scrape(urls[0] ?? "");
            if (result.error) {
                console.error(`Error scraping ${result.url}: ${result.error}`);
                process.exit(1);
            }
            if (jsonMode) {
                const out = JSON.stringify(result, null, 2);
                if (output) {
                    await Bun.write(output, out);
                    console.log(`Written to ${output}`);
                } else {
                    console.log(out);
                }
            } else {
                if (output) {
                    await Bun.write(output, result.markdown);
                    console.log(
                        `Written to ${output} (${result.metadata.wordCount} words, ${ms(result.timing.total)})`,
                    );
                } else {
                    console.log(result.markdown);
                }
            }
        } else {
            // Batch mode with streaming output
            const results: ScrapeResult[] = [];
            let completed = 0;

            for await (const result of scraper.scrapeStream(urls)) {
                completed++;
                const status = result.error ? "FAIL" : "OK";
                console.error(
                    `[${completed}/${urls.length}] ${status} ${result.url} (${ms(result.timing.total)})`,
                );

                if (jsonMode) {
                    results.push(result);
                } else if (output) {
                    const filename = output.replace(/(\.\w+)?$/, `-${completed}$1`);
                    await Bun.write(filename, result.markdown);
                    console.error(`  -> ${filename}`);
                } else {
                    // Print each result separated
                    console.log(`\n${"=".repeat(80)}`);
                    console.log(`SOURCE: ${result.url}`);
                    console.log(`${"=".repeat(80)}\n`);
                    console.log(result.markdown);
                }
            }

            if (jsonMode) {
                const out = JSON.stringify(results, null, 2);
                if (output) {
                    await Bun.write(output, out);
                    console.error(`Written JSON to ${output}`);
                } else {
                    console.log(out);
                }
            }
        }
    } finally {
        await scraper.shutdown();
    }
}

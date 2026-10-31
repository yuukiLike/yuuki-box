import type { D1Database as CloudflareD1Database } from '@cloudflare/workers-types';

// Supply the generated binding's type without mixing Worker DOM globals into Astro.
declare global { type D1Database = CloudflareD1Database; }

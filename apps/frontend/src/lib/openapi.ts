import { existsSync } from 'fs';
import { resolve } from 'path';
import { env } from '@/env';
import { createOpenAPI } from 'fumadocs-openapi/server';

/**
 * Prefer a locally bundled OpenAPI spec (openapi.local.json next to the frontend
 * package) when present — container builds can't reach the running backend to
 * fetch `${NEXT_PUBLIC_API_URL}/openapi.json`. The build stage drops the spec
 * there; local dev and normal runtime keep using the live API URL.
 */
const localSpec = resolve(process.cwd(), 'openapi.local.json');

export const openapi = createOpenAPI({
	input: [existsSync(localSpec) ? localSpec : `${env.NEXT_PUBLIC_API_URL}/openapi.json`],
});

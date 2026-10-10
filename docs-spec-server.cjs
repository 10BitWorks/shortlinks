// Serves the bundled OpenAPI spec, runs the frontend docs generation as a
// child process with NEXT_PUBLIC_API_URL pointed at itself, then exits with
// the child's exit code. Deterministic — no shell background-job races.
const http = require('http');
const fs = require('fs');
const { spawnSync } = require('child_process');

const spec = fs.readFileSync('apps/mcp-server/src/openapi.json');
const server = http.createServer((req, res) => {
	res.writeHead(200, { 'content-type': 'application/json' });
	res.end(spec);
});
server.listen(8787, '127.0.0.1', () => {
	const r = spawnSync('pnpm', ['--filter', '@apps/frontend', 'run', 'generate:docs'], {
		stdio: 'inherit',
		env: { ...process.env, NEXT_PUBLIC_API_URL: 'http://127.0.0.1:8787' },
	});
	server.close();
	process.exit(r.status ?? 1);
});

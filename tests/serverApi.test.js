process.env.NODE_ENV = 'test';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

let serverInstance;
let baseUrl;

describe('Express Server API Integration Tests', () => {
  before(async () => {
    const { default: app } = await import('../server/index.js');
    await new Promise((resolve) => {
      serverInstance = app.listen(0, () => {
        const port = serverInstance.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (serverInstance) {
      await new Promise((resolve) => serverInstance.close(resolve));
    }
  });

  it('GET /api/health returns healthy status', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'healthy');
  });

  it('GET /api/sheets/status returns diagnostic status without throwing', async () => {
    const res = await fetch(`${baseUrl}/api/sheets/status`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(typeof data.ready, 'boolean');
  });

  it('GET /api/audit/databases.json returns reference databases array', async () => {
    const res = await fetch(`${baseUrl}/api/audit/databases.json`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.databases));
    assert.ok(data.databases.length > 0);
  });

  it('GET /api/audit/update-rows.json returns saved audit updates', async () => {
    const res = await fetch(`${baseUrl}/api/audit/update-rows.json`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(typeof data.updateRows, 'object');
  });

  it('GET /api/data returns paginated response', async () => {
    const res = await fetch(`${baseUrl}/api/data?page=1&pageSize=10`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.rows));
    assert.strictEqual(typeof data.total, 'number');
  });
});

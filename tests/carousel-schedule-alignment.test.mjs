import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../functions/api/admin/carousels/index.js', import.meta.url), 'utf8');
const { alignCarouselSchedule, onRequestPost } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('carousel times move forward to the next hourly minute-ten publisher pass', () => {
  assert.deepEqual(alignCarouselSchedule('2026-11-26', '09:00'), { date: '2026-11-26', time: '09:10' });
  assert.deepEqual(alignCarouselSchedule('2026-11-26', '09:10'), { date: '2026-11-26', time: '09:10' });
  assert.deepEqual(alignCarouselSchedule('2026-11-26', '09:11'), { date: '2026-11-26', time: '10:10' });
  assert.deepEqual(alignCarouselSchedule('2026-11-30', '23:25'), { date: '2026-12-01', time: '00:10' });
});

test('carousel API sends only publisher-aligned schedules to the workflow', async (t) => {
  const payloads = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const payload = JSON.parse(options.body);
    payloads.push(payload);
    return Response.json({ ok: true, carousel: payload.carousel || payload.edits });
  });
  const image = (number) => ({
    original_url: `https://res.cloudinary.com/qa/image/upload/slide-${number}.jpg`,
    fit_mode: 'fill',
    crop_gravity: 'auto',
  });
  const request = new Request('https://admin.mindobirdwatching.com/api/admin/carousels', {
    method: 'POST',
    headers: { origin: 'https://admin.mindobirdwatching.com', 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'create_carousel',
      carousel: {
        featured_birds: 'QA carousel',
        scheduled_date: '2099-11-26',
        scheduled_time: '09:25',
        post_to_instagram: true,
        post_to_facebook: true,
        images: [image(1), image(2)],
      },
    }),
  });
  const response = await onRequestPost({ request, env: { N8N_ADMIN_CAROUSELS_WEBHOOK_URL: 'https://n8n.example.test/carousels' } });
  assert.equal(response.status, 200);
  assert.equal(payloads[0].carousel.scheduled_date, '2099-11-26');
  assert.equal(payloads[0].carousel.scheduled_time, '10:10');
});

import { describe, expect, it } from 'vitest';
import { deleteIgnoringNotFound } from '../support/crud.js';
import { captureHttpError } from '../support/errors.js';
import { liveKong, unique } from '../support/live.js';

describe('2.x regression tests (live)', () => {
  const kong = liveKong();

  it('regression #1: update() sends the new values and persists them', async () => {
    const service = await kong.services.create({
      name: unique('reg1-svc'),
      host: 'upstream',
      port: 8080,
      retries: 5,
    });

    try {
      const updated = await kong.services.update(service.id, { retries: 9, port: 8081 });
      expect(updated.retries).toBe(9);
      expect(updated.port).toBe(8081);

      const fetched = await kong.services.get(service.id);
      expect(fetched.retries).toBe(9);
      expect(fetched.port).toBe(8081);
    } finally {
      await deleteIgnoringNotFound(() => kong.services.delete(service.id));
    }
  });

  it('regression #2: all() walks past Kong default page size of 100 (105 consumers)', async () => {
    const tag = unique('reg2-105');
    const total = 105;
    const createdIds: string[] = [];

    try {
      const batchSize = 15;
      for (let start = 0; start < total; start += batchSize) {
        const count = Math.min(batchSize, total - start);
        const batch = await Promise.all(
          Array.from({ length: count }, (_, offset) =>
            kong.consumers.create({
              username: unique(`reg2-c-${start + offset}`),
              tags: [tag],
            }),
          ),
        );
        for (const consumer of batch) {
          createdIds.push(consumer.id);
        }
      }

      const listed = await kong.consumers.all({ tags: [tag] });
      expect(listed).toHaveLength(total);
      const listedIds = new Set(listed.map((c) => c.id));
      for (const id of createdIds) {
        expect(listedIds.has(id)).toBe(true);
      }
    } finally {
      const batchSize = 15;
      for (let start = 0; start < createdIds.length; start += batchSize) {
        const slice = createdIds.slice(start, start + batchSize);
        await Promise.all(
          slice.map((id) => deleteIgnoringNotFound(() => kong.consumers.delete(id))),
        );
      }
    }
  });

  it('regression #4: no client-side validation rejects inputs Kong accepts (host-only service, headers-only route)', async () => {
    let serviceId: string | undefined;
    let routeId: string | undefined;

    try {
      const service = await kong.services.create({ host: 'upstream' });
      serviceId = service.id;
      expect(service.host).toBe('upstream');

      const expectedHeaders = { 'x-regression-4': [unique('hdr')] };
      const route = await kong.routes.create({
        headers: expectedHeaders,
      });
      routeId = route.id;
      expect(route.headers).toEqual(expectedHeaders);

      const fetchedRoute = await kong.routes.get(route.id);
      expect(fetchedRoute.headers).toEqual(expectedHeaders);
    } finally {
      if (routeId) {
        const id = routeId;
        await deleteIgnoringNotFound(() => kong.routes.delete(id));
      }
      if (serviceId) {
        const id = serviceId;
        await deleteIgnoringNotFound(() => kong.services.delete(id));
      }
    }
  });

  it('regression #5: errors retain HTTP status and Kong schema violation details', async () => {
    const missingKey = unique('reg5-missing');
    const notFound = await captureHttpError(kong.services.get(missingKey));
    expect(notFound.status).toBe(404);
    expect(notFound.method).toBe('GET');
    expect(notFound.path).toBe(`/services/${missingKey}`);

    const badRequest = await captureHttpError(
      kong.services.create({
        host: 'upstream',
        port: 99_999,
      }),
    );
    expect(badRequest.status).toBe(400);
    expect(badRequest.kongName).toBe('schema violation');
    expect(badRequest.code).toBe(2);
    expect(badRequest.fields).toBeDefined();
    expect(badRequest.fields).toHaveProperty('port');
  });

  it('regression #7: delete(key) removes the entity and find() returns undefined', async () => {
    const name = unique('reg7-svc');
    const service = await kong.services.create({
      name,
      host: 'upstream',
      port: 8080,
    });

    try {
      await kong.services.delete(name);
      await expect(kong.services.find(name)).resolves.toBeUndefined();
      await expect(kong.services.find(service.id)).resolves.toBeUndefined();
    } finally {
      await deleteIgnoringNotFound(() => kong.services.delete(service.id));
    }
  });
});

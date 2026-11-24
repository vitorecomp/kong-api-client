import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  Collection,
  KongConnectionError,
  KongError,
  KongHttpError,
  Singleton,
  Transport,
  type Page,
  type Patch,
  type Upstream,
  type UpstreamInput,
} from '../../src/index.js';
import { createFakeFetch } from '../support/fake-fetch.js';

interface Widget {
  id: string;
  name: string;
  enabled: boolean;
}

interface WidgetInput {
  name: string;
  enabled?: boolean;
}

function makeClient() {
  const fake = createFakeFetch();
  const transport = new Transport({ adminUrl: 'http://localhost:8001', fetch: fake.fetch });
  return { fake, transport };
}

describe('Collection', () => {
  it('stores basePath and strips a trailing slash', () => {
    const { transport } = makeClient();
    expect(new Collection<Widget, WidgetInput>(transport, '/services').basePath).toBe('/services');
    expect(new Collection<Widget, WidgetInput>(transport, '/services/').basePath).toBe('/services');
    expect(
      new Collection<Widget, WidgetInput>(transport, '/services/billing/routes').basePath,
    ).toBe('/services/billing/routes');
  });

  it('lists one page with each form of tags and pagination params', async () => {
    const { fake, transport } = makeClient();
    const widgets = new Collection<Widget, WidgetInput>(transport, '/widgets');
    const page: Page<Widget> = { data: [{ id: '1', name: 'w1', enabled: true }], next: null };

    fake.json(page).json(page).json(page).json(page).json(page);

    await expect(widgets.list()).resolves.toEqual(page);
    await widgets.list({ size: 10, offset: 'cur-1', tags: 'raw:tag' });
    await widgets.list({ tags: ['a', 'b'] });
    await widgets.list({ tags: { all: ['x', 'y'] } });
    await widgets.list({ tags: { any: ['p', 'q'] } });

    expect(fake.requests[0]!.method).toBe('GET');
    expect(fake.requests[0]!.url).toBe('http://localhost:8001/widgets');

    const u1 = new URL(fake.requests[1]!.url);
    expect(u1.pathname).toBe('/widgets');
    expect(u1.searchParams.get('size')).toBe('10');
    expect(u1.searchParams.get('offset')).toBe('cur-1');
    expect(u1.searchParams.get('tags')).toBe('raw:tag');

    expect(new URL(fake.requests[2]!.url).searchParams.get('tags')).toBe('a,b');
    expect(new URL(fake.requests[3]!.url).searchParams.get('tags')).toBe('x,y');
    expect(new URL(fake.requests[4]!.url).searchParams.get('tags')).toBe('p/q');
  });

  it('iterates across pages following offset and passes size along, and collects with all()', async () => {
    const { fake, transport } = makeClient();
    const widgets = new Collection<Widget, WidgetInput>(transport, '/widgets');

    fake
      .json({
        data: [
          { id: '1', name: 'w1', enabled: true },
          { id: '2', name: 'w2', enabled: false },
        ],
        offset: 'page-2',
        next: '/widgets?offset=page-2',
      })
      .json({
        data: [{ id: '3', name: 'w3', enabled: true }],
        next: null,
      });

    const iterated: Widget[] = [];
    for await (const item of widgets.iterate({ size: 2, tags: ['env:prod'] })) {
      iterated.push(item);
    }

    expect(iterated.map((w) => w.id)).toEqual(['1', '2', '3']);
    expect(fake.requests).toHaveLength(2);
    const req1 = new URL(fake.requests[0]!.url);
    const req2 = new URL(fake.requests[1]!.url);
    expect(req1.searchParams.get('size')).toBe('2');
    expect(req1.searchParams.get('tags')).toBe('env:prod');
    expect(req1.searchParams.has('offset')).toBe(false);
    expect(req2.searchParams.get('size')).toBe('2');
    expect(req2.searchParams.get('tags')).toBe('env:prod');
    expect(req2.searchParams.get('offset')).toBe('page-2');

    fake
      .json({ data: [{ id: 'a', name: 'wa', enabled: true }], offset: 'o2' })
      .json({ data: [{ id: 'b', name: 'wb', enabled: true }], next: null });

    const all = await widgets.all({ size: 1 });
    expect(all.map((w) => w.id)).toEqual(['a', 'b']);
  });

  it('sends the right verb, encoded path, and body for get, create, update, upsert, and delete', async () => {
    const { fake, transport } = makeClient();
    const widgets = new Collection<Widget, WidgetInput>(transport, '/services/billing/routes');
    const entity: Widget = { id: '1', name: 'a b/c', enabled: true };

    fake.json(entity).json(entity, 201).json(entity).json(entity).empty(204);

    await expect(widgets.get('a b/c')).resolves.toEqual(entity);
    await expect(widgets.create({ name: 'a b/c', enabled: true })).resolves.toEqual(entity);
    await expect(widgets.update('a b/c', { enabled: false })).resolves.toEqual(entity);
    await expect(widgets.upsert('a b/c', { name: 'a b/c', enabled: true })).resolves.toEqual(
      entity,
    );
    await expect(widgets.delete('a b/c')).resolves.toBeUndefined();

    expect(fake.requests[0]).toMatchObject({
      method: 'GET',
      url: 'http://localhost:8001/services/billing/routes/a%20b%2Fc',
      body: undefined,
    });
    expect(fake.requests[1]).toMatchObject({
      method: 'POST',
      url: 'http://localhost:8001/services/billing/routes',
      json: { name: 'a b/c', enabled: true },
    });
    expect(fake.requests[2]).toMatchObject({
      method: 'PATCH',
      url: 'http://localhost:8001/services/billing/routes/a%20b%2Fc',
      json: { enabled: false },
    });
    expect(fake.requests[3]).toMatchObject({
      method: 'PUT',
      url: 'http://localhost:8001/services/billing/routes/a%20b%2Fc',
      json: { name: 'a b/c', enabled: true },
    });
    expect(fake.requests[4]).toMatchObject({
      method: 'DELETE',
      url: 'http://localhost:8001/services/billing/routes/a%20b%2Fc',
      body: undefined,
    });
  });

  it('rejects empty keys with KongError before making any request', async () => {
    const { fake, transport } = makeClient();
    const widgets = new Collection<Widget, WidgetInput>(transport, '/widgets');

    await expect(widgets.get('')).rejects.toThrow(KongError);
    await expect(widgets.find('')).rejects.toThrow(KongError);
    await expect(widgets.update('', { enabled: false })).rejects.toThrow(KongError);
    await expect(widgets.upsert('', { name: 'x' })).rejects.toThrow(KongError);
    await expect(widgets.delete('')).rejects.toThrow(KongError);
    expect(fake.requests).toHaveLength(0);
  });

  it('returns undefined on 404 in find() and rethrows every other error', async () => {
    const { fake, transport } = makeClient();
    const widgets = new Collection<Widget, WidgetInput>(transport, '/widgets');
    const entity: Widget = { id: '1', name: 'w1', enabled: true };

    fake
      .json(entity)
      .json({ message: 'Not found' }, 404, { statusText: 'Not Found' })
      .json({ message: 'Server error' }, 500, { statusText: 'Internal Server Error' })
      .error(new TypeError('network down'));

    await expect(widgets.find('w1')).resolves.toEqual(entity);
    await expect(widgets.find('missing')).resolves.toBeUndefined();
    await expect(widgets.find('boom')).rejects.toBeInstanceOf(KongHttpError);
    await expect(widgets.find('offline')).rejects.toBeInstanceOf(KongConnectionError);
  });

  it('forwards CallOptions.signal to transport requests', async () => {
    const { fake, transport } = makeClient();
    const widgets = new Collection<Widget, WidgetInput>(transport, '/widgets');
    const controller = new AbortController();
    const reason = new Error('cancelled');
    controller.abort(reason);

    await expect(widgets.list(undefined, { signal: controller.signal })).rejects.toBe(reason);
    await expect(widgets.get('w1', { signal: controller.signal })).rejects.toBe(reason);
    await expect(widgets.find('w1', { signal: controller.signal })).rejects.toBe(reason);
    await expect(widgets.create({ name: 'w1' }, { signal: controller.signal })).rejects.toBe(
      reason,
    );
    await expect(
      widgets.update('w1', { enabled: false }, { signal: controller.signal }),
    ).rejects.toBe(reason);
    await expect(widgets.upsert('w1', { name: 'w1' }, { signal: controller.signal })).rejects.toBe(
      reason,
    );
    await expect(widgets.delete('w1', { signal: controller.signal })).rejects.toBe(reason);
    expect(fake.requests).toHaveLength(0);
  });

  it('enforces input and pagination types at compile time', () => {
    const { transport } = makeClient();
    const widgets = new Collection<Widget, WidgetInput>(transport, '/widgets');

    expectTypeOf<ReturnType<Collection<Widget, WidgetInput>['list']>>().toEqualTypeOf<
      Promise<Page<Widget>>
    >();
    expectTypeOf<ReturnType<Collection<Widget, WidgetInput>['iterate']>>().toEqualTypeOf<
      AsyncGenerator<Widget, void, undefined>
    >();
    expectTypeOf<ReturnType<Collection<Widget, WidgetInput>['all']>>().toEqualTypeOf<
      Promise<Widget[]>
    >();
    expectTypeOf<ReturnType<Collection<Widget, WidgetInput>['find']>>().toEqualTypeOf<
      Promise<Widget | undefined>
    >();

    const typeChecks = () => {
      // @ts-expect-error offset is not accepted by iterate()
      void widgets.iterate({ offset: 'abc' });
      // @ts-expect-error offset is not accepted by all()
      void widgets.all({ offset: 'abc' });
      // @ts-expect-error name is required on create()
      void widgets.create({ enabled: true });
      // @ts-expect-error name is required on upsert()
      void widgets.upsert('w1', { enabled: true });
      // Partial input is allowed on update()
      void widgets.update('w1', { enabled: false });
    };
    expect(typeof typeChecks).toBe('function');
  });
});

describe('Singleton', () => {
  it('stores path and strips a trailing slash', () => {
    const { transport } = makeClient();
    expect(new Singleton<Widget, WidgetInput>(transport, '/routes/r1/service').path).toBe(
      '/routes/r1/service',
    );
    expect(new Singleton<Widget, WidgetInput>(transport, '/routes/r1/service/').path).toBe(
      '/routes/r1/service',
    );
  });

  it('sends the right verb, path, and body for get, update, and upsert', async () => {
    const { fake, transport } = makeClient();
    const singleton = new Singleton<Widget, WidgetInput>(transport, '/routes/r1/service');
    const entity: Widget = { id: 's1', name: 'billing', enabled: true };

    fake.json(entity).json(entity).json(entity);

    await expect(singleton.get()).resolves.toEqual(entity);
    await expect(singleton.update({ enabled: false })).resolves.toEqual(entity);
    await expect(singleton.upsert({ name: 'billing', enabled: true })).resolves.toEqual(entity);

    expect(fake.requests[0]).toMatchObject({
      method: 'GET',
      url: 'http://localhost:8001/routes/r1/service',
      body: undefined,
    });
    expect(fake.requests[1]).toMatchObject({
      method: 'PATCH',
      url: 'http://localhost:8001/routes/r1/service',
      json: { enabled: false },
    });
    expect(fake.requests[2]).toMatchObject({
      method: 'PUT',
      url: 'http://localhost:8001/routes/r1/service',
      json: { name: 'billing', enabled: true },
    });
  });

  it('returns undefined on 404 in find() and rethrows every other error', async () => {
    const { fake, transport } = makeClient();
    const singleton = new Singleton<Widget, WidgetInput>(transport, '/routes/r1/service');
    const entity: Widget = { id: 's1', name: 'billing', enabled: true };

    fake
      .json(entity)
      .json({ message: 'Not found' }, 404, { statusText: 'Not Found' })
      .json({ message: 'Forbidden' }, 403, { statusText: 'Forbidden' })
      .error(new TypeError('connection reset'));

    await expect(singleton.find()).resolves.toEqual(entity);
    await expect(singleton.find()).resolves.toBeUndefined();
    await expect(singleton.find()).rejects.toBeInstanceOf(KongHttpError);
    await expect(singleton.find()).rejects.toBeInstanceOf(KongConnectionError);
  });

  it('forwards CallOptions.signal to transport requests', async () => {
    const { fake, transport } = makeClient();
    const singleton = new Singleton<Widget, WidgetInput>(transport, '/routes/r1/service');
    const controller = new AbortController();
    const reason = new Error('aborted');
    controller.abort(reason);

    await expect(singleton.get({ signal: controller.signal })).rejects.toBe(reason);
    await expect(singleton.find({ signal: controller.signal })).rejects.toBe(reason);
    await expect(singleton.update({ enabled: false }, { signal: controller.signal })).rejects.toBe(
      reason,
    );
    await expect(singleton.upsert({ name: 's1' }, { signal: controller.signal })).rejects.toBe(
      reason,
    );
    expect(fake.requests).toHaveLength(0);
  });

  it('enforces input types at compile time', () => {
    const { transport } = makeClient();
    const singleton = new Singleton<Widget, WidgetInput>(transport, '/routes/r1/service');

    expectTypeOf<ReturnType<Singleton<Widget, WidgetInput>['get']>>().toEqualTypeOf<
      Promise<Widget>
    >();
    expectTypeOf<ReturnType<Singleton<Widget, WidgetInput>['find']>>().toEqualTypeOf<
      Promise<Widget | undefined>
    >();

    const typeChecks = () => {
      // @ts-expect-error name is required on upsert()
      void singleton.upsert({ enabled: true });
      // Partial input is allowed on update()
      void singleton.update({ enabled: false });
    };
    expect(typeof typeChecks).toBe('function');
  });
});

describe('Patch<T>', () => {
  it('merges nested records recursively while keeping arrays, maps, primitives, and nullability intact', () => {
    interface NestedInput {
      requiredTop: string;
      nullableTop?: string | null;
      record: {
        requiredInner: string;
        deep: {
          requiredLeaf: number;
          nullableLeaf?: number | null;
        };
      };
      nullableRecord?: {
        requiredField: boolean;
      } | null;
      items: Array<{ cost: number; ttl: string }>;
      readonlyTags: readonly string[];
      map: Record<string, { requiredVal: number; optionalVal?: string }>;
      nullableMap?: Record<string, string> | null;
    }

    expectTypeOf<Patch<string>>().toEqualTypeOf<string>();
    expectTypeOf<Patch<string | null>>().toEqualTypeOf<string | null>();
    expectTypeOf<Patch<Array<{ cost: number; ttl: string }>>>().toEqualTypeOf<
      Array<{ cost: number; ttl: string }>
    >();
    expectTypeOf<Patch<readonly string[]>>().toEqualTypeOf<readonly string[]>();
    expectTypeOf<Patch<Record<string, string>>>().toEqualTypeOf<Record<string, string>>();
    expectTypeOf<
      Patch<Record<string, { requiredVal: number; optionalVal?: string }>>
    >().toEqualTypeOf<Record<string, { requiredVal: number; optionalVal?: string }>>();
    expectTypeOf<Patch<Record<string, unknown>>>().toEqualTypeOf<Record<string, unknown>>();
    expectTypeOf<Patch<Record<string, string> | null>>().toEqualTypeOf<Record<
      string,
      string
    > | null>();

    const { transport } = makeClient();
    const nested = new Collection<Widget, NestedInput>(transport, '/nested');
    const nestedSingleton = new Singleton<Widget, NestedInput>(transport, '/nested/single');
    const upstreams = new Collection<Upstream, UpstreamInput>(transport, '/upstreams');

    const typeChecks = () => {
      // Nested patch on a record with required members compiles
      void nested.update('k', { record: { deep: { requiredLeaf: 42 } } });
      void nestedSingleton.update({ record: { deep: { nullableLeaf: null } } });
      void upstreams.update('u', { healthchecks: { active: { concurrency: 5 } } });

      // Null stays allowed where input type allows it
      void nested.update('k', { nullableTop: null, nullableRecord: null, nullableMap: null });

      // Arrays and maps are given whole
      void nested.update('k', { items: [{ cost: 1, ttl: '5m' }] });
      void nested.update('k', { map: { primary: { requiredVal: 1 } } });

      // Unknown field at any depth is an error
      // @ts-expect-error unknown top-level field
      void nested.update('k', { nope: true });
      // @ts-expect-error unknown nested field
      void nested.update('k', { record: { nope: true } });
      // @ts-expect-error unknown deeply nested field
      void nested.update('k', { record: { deep: { nope: true } } });
      // @ts-expect-error unknown deeply nested field on singleton
      void nestedSingleton.update({ record: { deep: { nope: true } } });
      // @ts-expect-error unknown deeply nested field on UpstreamInput
      void upstreams.update('u', { healthchecks: { active: { nope: 1 } } });

      // Array element type is unchanged (required fields stay required)
      // @ts-expect-error missing required ttl on array element
      void nested.update('k', { items: [{ cost: 1 }] });

      // Map value type is unchanged (required fields stay required)
      // @ts-expect-error missing required requiredVal on map value
      void nested.update('k', { map: { primary: {} } });

      // Null is rejected where input type does not allow it
      // @ts-expect-error requiredTop is not nullable
      void nested.update('k', { requiredTop: null });
      // @ts-expect-error record is not nullable
      void nested.update('k', { record: null });
    };

    expect(typeof typeChecks).toBe('function');
  });
});

import { describe, expect, it } from 'vitest';
import {
  UNRESOLVED_REF,
  buildCreateTags,
  computeManagedTags,
  diffEntity,
  tokenizeSchemaPath,
} from '../../src/apply/diff.js';

const MANAGED = 'managed-by:kong-api-client';

describe('tokenizeSchemaPath', () => {
  it('tokenizes top-level, nested record, array, and map wildcard paths', () => {
    expect(tokenizeSchemaPath('tags')).toEqual(['tags']);
    expect(tokenizeSchemaPath('config.methods')).toEqual(['config', 'methods']);
    expect(tokenizeSchemaPath('config.rules[].methods')).toEqual([
      'config',
      'rules',
      '[]',
      'methods',
    ]);
    expect(tokenizeSchemaPath('headers.*')).toEqual(['headers', '*']);
    expect(tokenizeSchemaPath('matrix[][]')).toEqual(['matrix', '[]', '[]']);
  });
});

describe('buildCreateTags and computeManagedTags', () => {
  it('adds the managed tag without duplicating it on create', () => {
    expect(buildCreateTags(undefined, MANAGED)).toEqual([MANAGED]);
    expect(buildCreateTags(null, MANAGED)).toEqual([MANAGED]);
    expect(buildCreateTags(['env:prod', 'team:a'], MANAGED)).toEqual([
      'env:prod',
      'team:a',
      MANAGED,
    ]);
    expect(buildCreateTags(['env:prod', MANAGED, 'env:prod'], MANAGED)).toEqual([
      'env:prod',
      MANAGED,
    ]);
  });

  it('requires exact declared tags plus managed tag (order-independent) when tags are declared', () => {
    expect(computeManagedTags(['b', 'a'], [MANAGED, 'a', 'b'], MANAGED)).toEqual({
      changed: false,
      desiredTags: ['b', 'a', MANAGED],
    });
    expect(computeManagedTags(['a'], [MANAGED, 'a', 'extra'], MANAGED)).toEqual({
      changed: true,
      desiredTags: ['a', MANAGED],
    });
    expect(computeManagedTags(['a'], ['a'], MANAGED)).toEqual({
      changed: true,
      desiredTags: ['a', MANAGED],
    });
    expect(computeManagedTags([], [MANAGED], MANAGED)).toEqual({
      changed: false,
      desiredTags: [MANAGED],
    });
  });

  it('preserves other tags and only ensures managed tag when tags are omitted', () => {
    expect(computeManagedTags(undefined, ['manual', MANAGED], MANAGED)).toEqual({
      changed: false,
      desiredTags: ['manual', MANAGED],
    });
    expect(computeManagedTags(undefined, ['manual'], MANAGED)).toEqual({
      changed: true,
      desiredTags: ['manual', MANAGED],
    });
    expect(computeManagedTags(undefined, null, MANAGED)).toEqual({
      changed: true,
      desiredTags: [MANAGED],
    });
  });
});

describe('diffEntity comparison rules', () => {
  it('compares declared record fields recursively while ignoring undeclared stored fields', () => {
    const equal = diffEntity(
      {
        name: 'log-1',
        config: { http_endpoint: 'https://logs.example.com', queue: { max_batch_size: 10 } },
      },
      {
        id: 'p1',
        name: 'log-1',
        enabled: true,
        tags: [MANAGED],
        config: {
          http_endpoint: 'https://logs.example.com',
          method: 'POST',
          queue: { max_batch_size: 10, max_bytes: 1_000_000 },
        },
      },
      { managedTag: MANAGED },
    );
    expect(equal).toEqual({ fields: [], patch: {} });

    const different = diffEntity(
      {
        name: 'log-1',
        config: { http_endpoint: 'https://logs.example.com', queue: { max_batch_size: 20 } },
      },
      {
        id: 'p1',
        name: 'log-1',
        tags: [MANAGED],
        config: {
          http_endpoint: 'https://logs.example.com',
          queue: { max_batch_size: 10, max_bytes: 1_000_000 },
        },
      },
      { managedTag: MANAGED },
    );
    expect(different).toEqual({
      fields: ['config'],
      patch: {
        config: { http_endpoint: 'https://logs.example.com', queue: { max_batch_size: 20 } },
      },
    });
  });

  it('compares records inside arrays for declared fields only', () => {
    const equal = diffEntity(
      { items: [{ host: 'a' }, { host: 'b' }] },
      {
        items: [
          { host: 'a', port: 80 },
          { host: 'b', port: 443 },
        ],
        tags: [MANAGED],
      },
      { managedTag: MANAGED },
    );
    expect(equal.fields).toEqual([]);

    const different = diffEntity(
      { items: [{ host: 'a' }, { host: 'c' }] },
      {
        items: [
          { host: 'a', port: 80 },
          { host: 'b', port: 443 },
        ],
        tags: [MANAGED],
      },
      { managedTag: MANAGED },
    );
    expect(different.fields).toEqual(['items']);
  });

  it('compares regular arrays in order (matching vs reordered vs length mismatch)', () => {
    const equal = diffEntity(
      { paths: ['/a', '/b'] },
      { paths: ['/a', '/b'], tags: [MANAGED] },
      { managedTag: MANAGED },
    );
    expect(equal.fields).toEqual([]);

    const reordered = diffEntity(
      { paths: ['/b', '/a'] },
      { paths: ['/a', '/b'], tags: [MANAGED] },
      { managedTag: MANAGED },
    );
    expect(reordered.fields).toEqual(['paths']);

    const shorter = diffEntity(
      { paths: ['/a'] },
      { paths: ['/a', '/b'], tags: [MANAGED] },
      { managedTag: MANAGED },
    );
    expect(shorter.fields).toEqual(['paths']);
  });

  it('compares top-level sets, sets of records, nested array sets, and map-value sets without order', () => {
    // Top-level set (protocols)
    const setEqual = diffEntity(
      { protocols: ['https', 'http'] },
      { protocols: ['http', 'https'], tags: [MANAGED] },
      { managedTag: MANAGED, setFields: ['protocols'] },
    );
    expect(setEqual.fields).toEqual([]);

    const setDiff = diffEntity(
      { protocols: ['https', 'grpc'] },
      { protocols: ['http', 'https'], tags: [MANAGED] },
      { managedTag: MANAGED, setFields: ['protocols'] },
    );
    expect(setDiff.fields).toEqual(['protocols']);

    // Duplicate items in desired set equal deduplicated stored set
    const setDup = diffEntity(
      { methods: ['GET', 'GET', 'POST'] },
      { methods: ['POST', 'GET'], tags: [MANAGED] },
      { managedTag: MANAGED, setFields: ['methods'] },
    );
    expect(setDup.fields).toEqual([]);

    // Set of records (e.g. routes.sources) with partial fields and reversed order
    const recordSetEqual = diffEntity(
      { sources: [{ ip: '10.0.0.1' }, { port: 8080 }] },
      {
        sources: [
          { ip: null, port: 8080 },
          { ip: '10.0.0.1', port: null },
        ],
        tags: [MANAGED],
      },
      { managedTag: MANAGED, setFields: ['sources'] },
    );
    expect(recordSetEqual.fields).toEqual([]);

    const recordSetDiff = diffEntity(
      { sources: [{ ip: '10.0.0.1' }, { port: 9090 }] },
      {
        sources: [
          { ip: null, port: 8080 },
          { ip: '10.0.0.1', port: null },
        ],
        tags: [MANAGED],
      },
      { managedTag: MANAGED, setFields: ['sources'] },
    );
    expect(recordSetDiff.fields).toEqual(['sources']);

    // Set inside records of an array: config.rules[].methods
    const nestedArraySetEqual = diffEntity(
      { config: { rules: [{ methods: ['POST', 'GET'] }] } },
      { config: { rules: [{ methods: ['GET', 'POST'], extra: true }] }, tags: [MANAGED] },
      { managedTag: MANAGED, setFields: ['config.rules[].methods'] },
    );
    expect(nestedArraySetEqual.fields).toEqual([]);

    const nestedArraySetDiff = diffEntity(
      { config: { rules: [{ methods: ['PUT', 'GET'] }] } },
      { config: { rules: [{ methods: ['GET', 'POST'] }] }, tags: [MANAGED] },
      { managedTag: MANAGED, setFields: ['config.rules[].methods'] },
    );
    expect(nestedArraySetDiff.fields).toEqual(['config']);

    // Map whose values are sets: headers.*
    const mapSetEqual = diffEntity(
      { headers: { 'X-Env': ['b', 'a'] } },
      { headers: { 'X-Env': ['a', 'b'] }, tags: [MANAGED] },
      { managedTag: MANAGED, setFields: ['headers.*'] },
    );
    expect(mapSetEqual.fields).toEqual([]);

    const mapSetDiff = diffEntity(
      { headers: { 'X-Env': ['c', 'a'] } },
      { headers: { 'X-Env': ['a', 'b'] }, tags: [MANAGED] },
      { managedTag: MANAGED, setFields: ['headers.*'] },
    );
    expect(mapSetDiff.fields).toEqual(['headers']);
  });

  it('treats null and absent fields as equal, and non-null vs null/absent as different', () => {
    const equal = diffEntity(
      { path: null, nested: { a: null, b: undefined } },
      { nested: {}, tags: [MANAGED] },
      { managedTag: MANAGED },
    );
    expect(equal.fields).toEqual([]);

    const nullVsValue = diffEntity(
      { path: null },
      { path: '/old', tags: [MANAGED] },
      { managedTag: MANAGED },
    );
    expect(nullVsValue).toEqual({ fields: ['path'], patch: { path: null } });

    const valueVsNull = diffEntity(
      { path: '/new' },
      { path: null, tags: [MANAGED] },
      { managedTag: MANAGED },
    );
    expect(valueVsNull).toEqual({ fields: ['path'], patch: { path: '/new' } });
  });

  it('compares resolved foreign references including unresolved dry-run refs and null', () => {
    const equal = diffEntity(
      { service: { name: 'billing' } },
      { service: { id: 'svc-uuid-1' }, tags: [MANAGED] },
      { managedTag: MANAGED, resolvedRefs: { service: 'svc-uuid-1' } },
    );
    expect(equal.fields).toEqual([]);

    const differentId = diffEntity(
      { service: { name: 'billing' } },
      { service: { id: 'svc-uuid-other' }, tags: [MANAGED] },
      { managedTag: MANAGED, resolvedRefs: { service: 'svc-uuid-1' } },
    );
    expect(differentId).toEqual({
      fields: ['service'],
      patch: { service: { name: 'billing' } },
    });

    const unresolvedDryRun = diffEntity(
      { service: { name: 'new-svc' } },
      { service: { id: 'svc-uuid-1' }, tags: [MANAGED] },
      { managedTag: MANAGED, resolvedRefs: { service: UNRESOLVED_REF } },
    );
    expect(unresolvedDryRun.fields).toEqual(['service']);

    const nullRefEqual = diffEntity(
      { service: null },
      { service: null, tags: [MANAGED] },
      { managedTag: MANAGED, resolvedRefs: { service: null } },
    );
    expect(nullRefEqual.fields).toEqual([]);

    const nullRefDiff = diffEntity(
      { service: null },
      { service: { id: 'svc-uuid-1' }, tags: [MANAGED] },
      { managedTag: MANAGED, resolvedRefs: { service: null } },
    );
    expect(nullRefDiff.fields).toEqual(['service']);
  });

  it('marks an existing entity matching all fields but lacking the managed tag as tags-only update', () => {
    const diff = diffEntity(
      { name: 'svc', host: 'example.com', port: 80 },
      { name: 'svc', host: 'example.com', port: 80, tags: ['user-tag'] },
      { managedTag: MANAGED },
    );
    expect(diff).toEqual({
      fields: ['tags'],
      patch: { tags: ['user-tag', MANAGED] },
    });
  });

  it('compares maps whole in both directions while keeping nested record and set rules inside map values', () => {
    // Equal maps regardless of key order
    const equal = diffEntity(
      { config: { headers: { 'x-a': '1', 'x-b': '2' } } },
      { config: { headers: { 'x-b': '2', 'x-a': '1' }, timeout: 10_000 }, tags: [MANAGED] },
      { managedTag: MANAGED, mapFields: ['config.headers'] },
    );
    expect(equal.fields).toEqual([]);

    // Key removed from map in config -> differs (whole map comparison)
    const removedKey = diffEntity(
      { config: { headers: { 'x-a': '1' } } },
      { config: { headers: { 'x-a': '1', 'x-b': '2' } }, tags: [MANAGED] },
      { managedTag: MANAGED, mapFields: ['config.headers'] },
    );
    expect(removedKey).toEqual({
      fields: ['config'],
      patch: { config: { headers: { 'x-a': '1' } } },
    });

    // Key added to map in config -> differs
    const addedKey = diffEntity(
      { config: { headers: { 'x-a': '1', 'x-b': '2' } } },
      { config: { headers: { 'x-a': '1' } }, tags: [MANAGED] },
      { managedTag: MANAGED, mapFields: ['config.headers'] },
    );
    expect(addedKey.fields).toEqual(['config']);

    // Key value changed in map -> differs
    const changedValue = diffEntity(
      { config: { headers: { 'x-a': '9' } } },
      { config: { headers: { 'x-a': '1' } }, tags: [MANAGED] },
      { managedTag: MANAGED, mapFields: ['config.headers'] },
    );
    expect(changedValue.fields).toEqual(['config']);

    // Empty map vs non-empty stored map -> differs; empty vs empty -> equal
    expect(
      diffEntity(
        { config: { headers: {} } },
        { config: { headers: { 'x-a': '1' } }, tags: [MANAGED] },
        { managedTag: MANAGED, mapFields: ['config.headers'] },
      ).fields,
    ).toEqual(['config']);
    expect(
      diffEntity(
        { config: { headers: {} } },
        { config: { headers: {} }, tags: [MANAGED] },
        { managedTag: MANAGED, mapFields: ['config.headers'] },
      ).fields,
    ).toEqual([]);

    // Null/absent values in stored map do not trigger spurious diff; undefined desired value treated as absent
    expect(
      diffEntity(
        { config: { headers: { 'x-a': '1', 'x-drop': undefined } } },
        { config: { headers: { 'x-a': '1', 'x-null': null } }, tags: [MANAGED] },
        { managedTag: MANAGED, mapFields: ['config.headers'] },
      ).fields,
    ).toEqual([]);
    expect(
      diffEntity(
        { config: { headers: { 'x-a': '1', 'x-drop': undefined } } },
        { config: { headers: { 'x-a': '1', 'x-drop': '2' } }, tags: [MANAGED] },
        { managedTag: MANAGED, mapFields: ['config.headers'] },
      ).fields,
    ).toEqual(['config']);

    // Map whose values are records: map keys are compared whole, record values only for declared fields
    expect(
      diffEntity(
        { config: { limits: { requests: { minute: 100 } } } },
        { config: { limits: { requests: { minute: 100, hour: 5000 } } }, tags: [MANAGED] },
        { managedTag: MANAGED, mapFields: ['config.limits'] },
      ).fields,
    ).toEqual([]);
    expect(
      diffEntity(
        { config: { limits: { requests: { minute: 100 } } } },
        {
          config: { limits: { requests: { minute: 100 }, tokens: { minute: 50 } } },
          tags: [MANAGED],
        },
        { managedTag: MANAGED, mapFields: ['config.limits'] },
      ).fields,
    ).toEqual(['config']);
  });

  it('handles type mismatches between array/object/primitive cleanly', () => {
    expect(
      diffEntity({ a: [1] }, { a: { x: 1 }, tags: [MANAGED] }, { managedTag: MANAGED }).fields,
    ).toEqual(['a']);
    expect(
      diffEntity({ a: { x: 1 } }, { a: 'str', tags: [MANAGED] }, { managedTag: MANAGED }).fields,
    ).toEqual(['a']);
    expect(
      diffEntity(
        { service: { name: 's' } },
        { service: 'not-an-object', tags: [MANAGED] },
        { managedTag: MANAGED, resolvedRefs: { service: 'id-1' } },
      ).fields,
    ).toEqual(['service']);
  });
});

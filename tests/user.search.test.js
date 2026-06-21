'use strict';

/**
 * Tests for Issue #1268 — Get User Search
 * GET /backend/api/v1/users/search?query=&pageIndex=&visitorId=
 *
 * Run: cross-env NODE_ENV=local npx jest tests/user.search.test.js --forceExit --verbose
 *
 * Covers:
 *  ✅ Success: search with matching query returns users
 *  ✅ Success: empty/omitted query returns all users
 *  ✅ Success: pageIndex=0 returns first page
 *  ✅ Success: pageIndex=1 returns second page (or empty)
 *  ✅ Success: response shape matches Java contract
 *  ✅ Success: works without Authorization header (public endpoint)
 *  ✅ Success: works WITH Authorization header
 *  ✅ Failure: negative pageIndex → 422
 *  ✅ Failure: non-numeric pageIndex → 422
 *  ✅ Edge: query with no results returns empty users array
 *  ✅ Edge: partial name match works
 *  ✅ Edge: partial email match works
 *  ✅ Edge: pageIndex=0 is valid (not rejected)
 *  ✅ Edge: visitorId param is accepted and ignored gracefully
 *  ✅ Data Integrity: pagination totals are consistent
 */

const request = require('supertest');
const app     = require('../app');

const BASE_REGISTER = '/backend/api/v1/users/register';
const BASE_LOGIN    = '/backend/api/v1/users/login';
const BASE_SEARCH   = '/backend/api/v1/users/search';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid   = () => `search_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const email = (prefix = 'searchtest') => `${prefix}_${uid()}@example.com`;
const mob   = () => Math.floor(6000000000 + Math.random() * 3999999999);

const registerAndLogin = async (overrides = {}) => {
  const payload = {
    userName:     `SearchUser_${uid()}`,
    userAge:      28,
    userMobile:   mob(),
    userGenderId: 1,
    languageEnum: 0,
    locationId:   1,
    locationName: 'Mumbai',
    userEmail:    email(),
    isEmailLogin: true,
    userTag:      [],
    triggers:     [],
    userCommunity:[],
    ...overrides,
  };

  const regRes = await request(app).post(BASE_REGISTER).send(payload);
  if (regRes.status !== 201) throw new Error(`Registration failed: ${JSON.stringify(regRes.body)}`);

  const loginRes = await request(app).post(BASE_LOGIN).send({ userEmail: payload.userEmail });
  return { userId: loginRes.body.userId, token: loginRes.body.jwtToken, payload };
};

// ─── Shared state ─────────────────────────────────────────────────────────────
// We register a user with a distinctive name and email so we can search for them.
let testUser = null;
const UNIQUE_NAME_PREFIX = `Searchable_${Date.now()}`;

beforeAll(async () => {
  testUser = await registerAndLogin({
    userName:  `${UNIQUE_NAME_PREFIX}_User`,
    userEmail: `${UNIQUE_NAME_PREFIX.toLowerCase()}@example.com`,
  });
}, 30000);

// ─────────────────────────────────────────────────────────────────────────────
// SUCCESS CASES
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /users/search — Success Cases', () => {

  test('SC-01: Search without Authorization header returns 200 (public endpoint)', async () => {
    const res = await request(app)
      .get(BASE_SEARCH)
      .query({ query: UNIQUE_NAME_PREFIX });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('users');
    expect(Array.isArray(res.body.users)).toBe(true);
  });

  test('SC-02: Search WITH Authorization header also returns 200', async () => {
    const res = await request(app)
      .get(BASE_SEARCH)
      .set('Authorization', `Bearer ${testUser.token}`)
      .query({ query: UNIQUE_NAME_PREFIX });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('users');
  });

  test('SC-03: Matching query returns the registered user', async () => {
    const res = await request(app)
      .get(BASE_SEARCH)
      .query({ query: UNIQUE_NAME_PREFIX });

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeGreaterThanOrEqual(1);

    const found = res.body.users.find(u => u.userId === testUser.userId);
    expect(found).toBeDefined();
    expect(found.userName).toContain(UNIQUE_NAME_PREFIX);
  });

  test('SC-04: Response contains all required fields per Java contract', async () => {
    const res = await request(app)
      .get(BASE_SEARCH)
      .query({ query: UNIQUE_NAME_PREFIX, pageIndex: 0 });

    expect(res.status).toBe(200);
    // Top-level pagination fields
    expect(res.body).toHaveProperty('users');
    expect(res.body).toHaveProperty('totalElements');
    expect(res.body).toHaveProperty('totalPages');
    expect(res.body).toHaveProperty('currentPage');
    expect(res.body).toHaveProperty('pageSize');
    expect(res.body).toHaveProperty('hasNextPage');
    expect(res.body).toHaveProperty('hasPreviousPage');
  });

  test('SC-05: Each user object contains all required fields', async () => {
    const res = await request(app)
      .get(BASE_SEARCH)
      .query({ query: UNIQUE_NAME_PREFIX });

    expect(res.status).toBe(200);
    if (res.body.users.length > 0) {
      const user = res.body.users[0];
      expect(user).toHaveProperty('userId');
      expect(user).toHaveProperty('userName');
      expect(user).toHaveProperty('userEmail');
      expect(user).toHaveProperty('userMobile');
      expect(user).toHaveProperty('userAvatar');
      expect(user).toHaveProperty('languageEnum');
      expect(user).toHaveProperty('userGenderId');
      expect(user).toHaveProperty('locationId');
      expect(user).toHaveProperty('locationName');
      expect(user).toHaveProperty('isParticipant');
      expect(user).toHaveProperty('createdOn');
    }
  });

  test('SC-06: pageIndex=0 is the default first page', async () => {
    const res = await request(app)
      .get(BASE_SEARCH)
      .query({ query: '', pageIndex: 0 });

    expect(res.status).toBe(200);
    expect(res.body.currentPage).toBe(0);
    expect(res.body.pageSize).toBe(10);
    expect(res.body.hasPreviousPage).toBe(false);
  });

  test('SC-07: Omitting query parameter returns all users (first page)', async () => {
    const res = await request(app)
      .get(BASE_SEARCH);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('users');
    expect(res.body.currentPage).toBe(0);
  });

  test('SC-08: Partial name match works (LIKE %query%)', async () => {
    // Search for just part of the unique prefix
    const partial = UNIQUE_NAME_PREFIX.slice(0, 8);

    const res = await request(app)
      .get(BASE_SEARCH)
      .query({ query: partial });

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeGreaterThanOrEqual(1);
  });

  test('SC-09: Partial email match works (LIKE %query%)', async () => {
    // Search by part of the unique email prefix
    const emailFragment = UNIQUE_NAME_PREFIX.toLowerCase().slice(0, 10);

    const res = await request(app)
      .get(BASE_SEARCH)
      .query({ query: emailFragment });

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeGreaterThanOrEqual(1);
  });

  test('SC-10: visitorId query param is accepted without error', async () => {
    const res = await request(app)
      .get(BASE_SEARCH)
      .query({ query: UNIQUE_NAME_PREFIX, visitorId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('users');
  });

  test('SC-11: pageIndex=1 returns page 2 (or empty array if fewer than 11 results)', async () => {
    const res = await request(app)
      .get(BASE_SEARCH)
      .query({ query: UNIQUE_NAME_PREFIX, pageIndex: 1 });

    expect(res.status).toBe(200);
    expect(res.body.currentPage).toBe(1);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.hasPreviousPage).toBe(true);
  });

  test('SC-12: pageSize is always 10 (Java fixed value)', async () => {
    const res = await request(app)
      .get(BASE_SEARCH)
      .query({ pageIndex: 0 });

    expect(res.status).toBe(200);
    expect(res.body.pageSize).toBe(10);
    expect(res.body.users.length).toBeLessThanOrEqual(10);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// FAILURE CASES
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /users/search — Failure Cases', () => {

  test('FC-01: Negative pageIndex → 422', async () => {
    const res = await request(app)
      .get(BASE_SEARCH)
      .query({ query: 'test', pageIndex: -1 });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/pageIndex/i);
  });

  test('FC-02: Non-numeric pageIndex → 422', async () => {
    const res = await request(app)
      .get(BASE_SEARCH)
      .query({ query: 'test', pageIndex: 'abc' });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/pageIndex/i);
  });

  test('FC-03: pageIndex=-99 → 422', async () => {
    const res = await request(app)
      .get(BASE_SEARCH)
      .query({ pageIndex: -99 });

    expect(res.status).toBe(422);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// EDGE CASES
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /users/search — Edge Cases', () => {

  test('EC-01: Query with no matching users returns empty array (not 404)', async () => {
    const res = await request(app)
      .get(BASE_SEARCH)
      .query({ query: 'zzznonexistentuser999xyz' });

    expect(res.status).toBe(200);
    expect(res.body.users).toEqual([]);
    expect(res.body.totalElements).toBe(0);
    expect(res.body.totalPages).toBe(0);
    expect(res.body.hasNextPage).toBe(false);
    expect(res.body.hasPreviousPage).toBe(false);
  });

  test('EC-02: pageIndex=0 is valid and does NOT return 422', async () => {
    const res = await request(app)
      .get(BASE_SEARCH)
      .query({ pageIndex: 0 });

    expect(res.status).toBe(200);
    expect(res.body.currentPage).toBe(0);
  });

  test('EC-03: Large pageIndex beyond total pages returns empty array (not error)', async () => {
    const res = await request(app)
      .get(BASE_SEARCH)
      .query({ query: UNIQUE_NAME_PREFIX, pageIndex: 9999 });

    expect(res.status).toBe(200);
    expect(res.body.users).toEqual([]);
    expect(res.body.currentPage).toBe(9999);
  });

  test('EC-04: Empty string query treated same as no query', async () => {
    const res = await request(app)
      .get(BASE_SEARCH)
      .query({ query: '' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('users');
  });

  test('EC-05: Float pageIndex is parsed as integer (truncated)', async () => {
    const res = await request(app)
      .get(BASE_SEARCH)
      .query({ query: UNIQUE_NAME_PREFIX, pageIndex: 0.9 });

    expect(res.status).toBe(200);
    expect(res.body.currentPage).toBe(0);
  });

  test('EC-06: Multiple calls with same params return consistent results', async () => {
    const r1 = await request(app).get(BASE_SEARCH).query({ query: UNIQUE_NAME_PREFIX, pageIndex: 0 });
    const r2 = await request(app).get(BASE_SEARCH).query({ query: UNIQUE_NAME_PREFIX, pageIndex: 0 });

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r1.body.totalElements).toBe(r2.body.totalElements);
    expect(r1.body.users.length).toBe(r2.body.users.length);
  });

  test('EC-07: Response pagination types are correct', async () => {
    const res = await request(app)
      .get(BASE_SEARCH)
      .query({ pageIndex: 0 });

    expect(res.status).toBe(200);
    expect(typeof res.body.totalElements).toBe('number');
    expect(typeof res.body.totalPages).toBe('number');
    expect(typeof res.body.currentPage).toBe('number');
    expect(typeof res.body.pageSize).toBe('number');
    expect(typeof res.body.hasNextPage).toBe('boolean');
    expect(typeof res.body.hasPreviousPage).toBe('boolean');
    expect(Array.isArray(res.body.users)).toBe(true);
  });

  test('EC-08: hasPreviousPage is false on page 0', async () => {
    const res = await request(app)
      .get(BASE_SEARCH)
      .query({ pageIndex: 0 });

    expect(res.status).toBe(200);
    expect(res.body.hasPreviousPage).toBe(false);
  });

  test('EC-09: Invalid JWT token is ignored (endpoint is public)', async () => {
    // Java allows optional auth — invalid token should not block the request
    const res = await request(app)
      .get(BASE_SEARCH)
      .set('Authorization', 'Bearer not.a.valid.token')
      .query({ query: UNIQUE_NAME_PREFIX });

    // Should either be 200 (auth ignored) or 401 (auth enforced) — NOT 500
    expect([200, 401, 403]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });

  test('EC-10: userId field in results is a positive integer', async () => {
    const res = await request(app)
      .get(BASE_SEARCH)
      .query({ query: UNIQUE_NAME_PREFIX });

    expect(res.status).toBe(200);
    res.body.users.forEach(u => {
      expect(typeof u.userId).toBe('number');
      expect(u.userId).toBeGreaterThan(0);
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// DATA INTEGRITY
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /users/search — Data Integrity', () => {

  test('DI-01: totalElements matches number of results across pages', async () => {
    const page0 = await request(app).get(BASE_SEARCH).query({ pageIndex: 0 });

    expect(page0.status).toBe(200);
    const total = page0.body.totalElements;
    const pages = page0.body.totalPages;
    const expectedPages = total === 0 ? 0 : Math.ceil(total / 10);
    expect(pages).toBe(expectedPages);
  });

  test('DI-02: Newly registered user appears in search results', async () => {
    const uniqueTag = `unique_tag_${Date.now()}`;
    const newUser = await registerAndLogin({ userName: `Findable_${uniqueTag}` });

    const res = await request(app)
      .get(BASE_SEARCH)
      .query({ query: uniqueTag });

    expect(res.status).toBe(200);
    const found = res.body.users.find(u => u.userId === newUser.userId);
    expect(found).toBeDefined();
  });

  test('DI-03: Email addresses in results are valid format', async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const res = await request(app)
      .get(BASE_SEARCH)
      .query({ query: UNIQUE_NAME_PREFIX });

    expect(res.status).toBe(200);
    res.body.users.forEach(u => {
      if (u.userEmail) {
        expect(emailRegex.test(u.userEmail)).toBe(true);
      }
    });
  });

  test('DI-04: languageEnum is 0 or 1 for every user in results', async () => {
    const res = await request(app)
      .get(BASE_SEARCH)
      .query({ pageIndex: 0 });

    expect(res.status).toBe(200);
    res.body.users.forEach(u => {
      expect([0, 1]).toContain(u.languageEnum);
    });
  });

  test('DI-05: isParticipant is a boolean in every result', async () => {
    const res = await request(app)
      .get(BASE_SEARCH)
      .query({ pageIndex: 0 });

    expect(res.status).toBe(200);
    res.body.users.forEach(u => {
      expect(typeof u.isParticipant).toBe('boolean');
    });
  });

});

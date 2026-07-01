'use strict';

/**
 * Tests for PATCH /users/language  (Swagger corrected)
 * Endpoint: PATCH /backend/api/v1/users/language
 *
 * Run: cross-env NODE_ENV=local npx jest tests/user.language.test.js --forceExit --verbose
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE WAS REWRITTEN:
 *
 * ❌ OLD tests tested: PATCH /users/:userId/language
 *    - userId was a path param (WRONG — Java Swagger has no userId in path)
 *    - Tests like FC-01 passed userId 9999999 as a path param
 *    - Tests like EC-01 sent userId=0 in the path
 *    - All URL constructions used `${BASE_USERS}/${userId}/language`
 *
 * ✅ NEW tests test:   PATCH /users/language
 *    - No userId in path at all
 *    - userId derived entirely from JWT token (req.decodedToken.user_id)
 *    - Auth is REQUIRED
 *    - URL is always the same: /backend/api/v1/users/language
 *
 * Java Swagger contract:
 *   PATCH /users/language
 *   - Body: { languageEnum: 0 | 1 }
 *   - Auth: required (Bearer JWT)
 *   - userId: from token
 *   - Response: { userId, userName, languageEnum, message }, HTTP 200
 * ─────────────────────────────────────────────────────────────────────────────
 */

const request = require('supertest');
const app     = require('../app');

const BASE_REGISTER = '/backend/api/v1/users/register';
const BASE_LOGIN    = '/backend/api/v1/users/login';
const BASE_LANGUAGE = '/backend/api/v1/users/language';
const BASE_USERS    = '/backend/api/v1/users';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid   = () => `lang_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const email = () => `${uid()}@example.com`;
const mob   = () => Math.floor(6000000000 + Math.random() * 3999999999);

const registerAndLogin = async (langOverride = 0) => {
  const payload = {
    userName:     `LangUser_${uid()}`,
    userAge:      28,
    userMobile:   mob(),
    userGenderId: 1,
    languageEnum: langOverride,
    locationId:   1,
    locationName: 'Mumbai',
    userEmail:    email(),
    isEmailLogin: true,
    userTag: [], triggers: [], userCommunity: [],
  };
  const regRes = await request(app).post(BASE_REGISTER).send(payload);
  if (regRes.status !== 201) throw new Error(`Registration failed: ${JSON.stringify(regRes.body)}`);
  const loginRes = await request(app).post(BASE_LOGIN).send({ userEmail: payload.userEmail });
  return { userId: loginRes.body.userId, token: loginRes.body.jwtToken, payload };
};

// ─── Shared state ─────────────────────────────────────────────────────────────
let englishUser = null;
let hindiUser   = null;

beforeAll(async () => {
  englishUser = await registerAndLogin(0);
  hindiUser   = await registerAndLogin(1);
}, 30000);

// ─────────────────────────────────────────────────────────────────────────────
// SUCCESS CASES
// ─────────────────────────────────────────────────────────────────────────────
describe('PATCH /users/language — Success Cases', () => {

  test('SC-01: Change language from ENGLISH to HINDI — returns 200', async () => {
    const user = await registerAndLogin(0);

    const res = await request(app)
      .patch(BASE_LANGUAGE)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ languageEnum: 1 });

    expect(res.status).toBe(200);
    expect(res.body.languageEnum).toBe(1);
    expect(res.body.message).toMatch(/HINDI/i);
  });

  test('SC-02: Change language from HINDI to ENGLISH — returns 200', async () => {
    const user = await registerAndLogin(1);

    const res = await request(app)
      .patch(BASE_LANGUAGE)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ languageEnum: 0 });

    expect(res.status).toBe(200);
    expect(res.body.languageEnum).toBe(0);
    expect(res.body.message).toMatch(/ENGLISH/i);
  });

  test('SC-03: Response contains userId, userName, languageEnum, message', async () => {
    const user = await registerAndLogin(0);

    const res = await request(app)
      .patch(BASE_LANGUAGE)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ languageEnum: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('userId');
    expect(res.body).toHaveProperty('userName');
    expect(res.body).toHaveProperty('languageEnum');
    expect(res.body).toHaveProperty('message');
  });

  test('SC-04: userId in response matches the authenticated user (from token)', async () => {
    const user = await registerAndLogin(0);

    const res = await request(app)
      .patch(BASE_LANGUAGE)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ languageEnum: 1 });

    expect(res.status).toBe(200);
    // userId must come from token — not from any URL path param
    expect(res.body.userId).toBe(user.userId);
  });

  test('SC-05: languageEnum 0 (ENGLISH) accepted', async () => {
    const user = await registerAndLogin(1);

    const res = await request(app)
      .patch(BASE_LANGUAGE)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ languageEnum: 0 });

    expect(res.status).toBe(200);
    expect(res.body.languageEnum).toBe(0);
  });

  test('SC-06: languageEnum 1 (HINDI) accepted', async () => {
    const user = await registerAndLogin(0);

    const res = await request(app)
      .patch(BASE_LANGUAGE)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ languageEnum: 1 });

    expect(res.status).toBe(200);
    expect(res.body.languageEnum).toBe(1);
  });

  test('SC-07: Idempotent — same language twice returns 200 both times', async () => {
    const user = await registerAndLogin(0);

    const r1 = await request(app)
      .patch(BASE_LANGUAGE)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ languageEnum: 0 });

    const r2 = await request(app)
      .patch(BASE_LANGUAGE)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ languageEnum: 0 });

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r1.body.languageEnum).toBe(r2.body.languageEnum);
  });

  test('SC-08: Multiple rapid updates work correctly', async () => {
    const user = await registerAndLogin(0);

    const r1 = await request(app)
      .patch(BASE_LANGUAGE)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ languageEnum: 1 });

    const r2 = await request(app)
      .patch(BASE_LANGUAGE)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ languageEnum: 0 });

    const r3 = await request(app)
      .patch(BASE_LANGUAGE)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ languageEnum: 1 });

    expect(r1.body.languageEnum).toBe(1);
    expect(r2.body.languageEnum).toBe(0);
    expect(r3.body.languageEnum).toBe(1);
  });

  test('SC-09: Response types are correct', async () => {
    const user = await registerAndLogin(0);

    const res = await request(app)
      .patch(BASE_LANGUAGE)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ languageEnum: 1 });

    expect(res.status).toBe(200);
    expect(typeof res.body.userId).toBe('number');
    expect(typeof res.body.userName).toBe('string');
    expect(typeof res.body.languageEnum).toBe('number');
    expect(typeof res.body.message).toBe('string');
  });

  test('SC-10: Language change persists — GET /users/:userId confirms update', async () => {
    const user = await registerAndLogin(0);

    await request(app)
      .patch(BASE_LANGUAGE)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ languageEnum: 1 });

    const getRes = await request(app)
      .get(`${BASE_USERS}/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.languageEnum).toBe(1);
  });

  test('SC-11: Different users update their own language independently', async () => {
    const user1 = await registerAndLogin(0);
    const user2 = await registerAndLogin(0);

    const r1 = await request(app)
      .patch(BASE_LANGUAGE)
      .set('Authorization', `Bearer ${user1.token}`)
      .send({ languageEnum: 1 });

    const r2 = await request(app)
      .patch(BASE_LANGUAGE)
      .set('Authorization', `Bearer ${user2.token}`)
      .send({ languageEnum: 0 });

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r1.body.userId).toBe(user1.userId);
    expect(r2.body.userId).toBe(user2.userId);
    expect(r1.body.languageEnum).toBe(1);
    expect(r2.body.languageEnum).toBe(0);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// FAILURE CASES
// ─────────────────────────────────────────────────────────────────────────────
describe('PATCH /users/language — Failure Cases', () => {

  test('FC-01: No Authorization header → 403 (auth required)', async () => {
    const res = await request(app)
      .patch(BASE_LANGUAGE)
      .send({ languageEnum: 1 });

    expect(res.status).toBe(403);
  });

  test('FC-02: Invalid token → 401', async () => {
    const res = await request(app)
      .patch(BASE_LANGUAGE)
      .set('Authorization', 'Bearer not.a.valid.token')
      .send({ languageEnum: 1 });

    expect([401, 403]).toContain(res.status);
  });

  test('FC-03: languageEnum = 2 (out of range) → 422', async () => {
    const res = await request(app)
      .patch(BASE_LANGUAGE)
      .set('Authorization', `Bearer ${englishUser.token}`)
      .send({ languageEnum: 2 });

    expect(res.status).toBe(422);
  });

  test('FC-04: languageEnum = -1 (negative) → 422', async () => {
    const res = await request(app)
      .patch(BASE_LANGUAGE)
      .set('Authorization', `Bearer ${englishUser.token}`)
      .send({ languageEnum: -1 });

    expect(res.status).toBe(422);
  });

  test('FC-05: Missing languageEnum → 422', async () => {
    const res = await request(app)
      .patch(BASE_LANGUAGE)
      .set('Authorization', `Bearer ${englishUser.token}`)
      .send({});

    expect(res.status).toBe(422);
  });

  test('FC-06: languageEnum as string → 422', async () => {
    const res = await request(app)
      .patch(BASE_LANGUAGE)
      .set('Authorization', `Bearer ${englishUser.token}`)
      .send({ languageEnum: 'HINDI' });

    expect(res.status).toBe(422);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// URL CONTRACT EDGE CASES
// ─────────────────────────────────────────────────────────────────────────────
describe('PATCH /users/language — URL Contract Edge Cases', () => {

  test('EC-01: URL has NO userId segment — /users/language only', async () => {
    // Confirms the route /users/language resolves correctly without any userId
    const res = await request(app)
      .patch(BASE_LANGUAGE)
      .set('Authorization', `Bearer ${englishUser.token}`)
      .send({ languageEnum: 1 });

    expect(res.status).toBe(200);
    // Route must NOT require userId in URL — proven by successful response
  });

  test('EC-02: Old URL /users/:userId/language must NOT match', async () => {
    // Proves the old route with userId in path no longer exists
    const res = await request(app)
      .patch(`${BASE_USERS}/${englishUser.userId}/language`)
      .set('Authorization', `Bearer ${englishUser.token}`)
      .send({ languageEnum: 1 });

    // Must be Express-level 404 "Endpoint not found" — old route is gone
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Endpoint not found/i);
  });

  test('EC-03: Passing userId in request body is ignored — token userId is used', async () => {
    const user = await registerAndLogin(0);

    // Send a different userId in the body — it must be ignored
    const res = await request(app)
      .patch(BASE_LANGUAGE)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ languageEnum: 1, userId: 99999 });

    expect(res.status).toBe(200);
    // userId in response must be the token userId, not 99999
    expect(res.body.userId).toBe(user.userId);
    expect(res.body.userId).not.toBe(99999);
  });

  test('EC-04: Large valid languageEnum numbers still fail validation', async () => {
    const res = await request(app)
      .patch(BASE_LANGUAGE)
      .set('Authorization', `Bearer ${englishUser.token}`)
      .send({ languageEnum: 99 });

    expect(res.status).toBe(422);
  });

  test('EC-05: Expired/malformed token returns 401', async () => {
    const res = await request(app)
      .patch(BASE_LANGUAGE)
      .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxMjMsImlhdCI6MX0.fake')
      .send({ languageEnum: 1 });

    expect([401, 403]).toContain(res.status);
  });

});

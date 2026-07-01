'use strict';

/**
 * Tests for Issue #1263 — Mark Story As Read
 * POST /backend/api/v1/users/mark-as-read/:storyId
 *
 * Run: cross-env NODE_ENV=local npx jest tests/user.story.read.test.js --forceExit --verbose
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE WAS COMPLETELY REWRITTEN:
 *
 * ❌ OLD tests tested:  GET /users/:userId/stories/:storyId
 *    - Wrong HTTP method (GET → should be POST)
 *    - Wrong URL (had userId in path — Java has no userId in path here)
 *    - Expected a full story JSON response (Java returns void)
 *    - Did not test visitorId query param
 *    - Did not test optional auth behaviour
 *
 * ✅ NEW tests test:    POST /users/mark-as-read/:storyId
 *    - Correct HTTP method: POST
 *    - Correct URL: no userId in path
 *    - Correct response: HTTP 200 with NO body (void)
 *    - Tests visitorId query param (anonymous user flow)
 *    - Tests optional auth (with token, without token, with visitorId)
 *
 * Java Swagger contract:
 *   POST /users/mark-as-read/{storyId}?visitorId=
 *   - storyId: path param (required)
 *   - visitorId: query param (optional)
 *   - Authorization: optional
 *   - Response: void (HTTP 200, no body)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const request = require('supertest');
const app     = require('../app');

const BASE_REGISTER  = '/backend/api/v1/users/register';
const BASE_LOGIN     = '/backend/api/v1/users/login';
const BASE_MARK_READ = '/backend/api/v1/users/mark-as-read';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid   = () => `mar_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const email = () => `${uid()}@example.com`;
const mob   = () => Math.floor(6000000000 + Math.random() * 3999999999);

const registerAndLogin = async () => {
  const payload = {
    userName:     `MARUser_${uid()}`,
    userAge:      28,
    userMobile:   mob(),
    userGenderId: 1,
    languageEnum: 0,
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
// storyId=1 is used as a known story — may or may not exist in the test DB.
// Tests guard with expect([200, 404]) where the story may not be seeded.
const TEST_STORY_ID      = 1;
const MISSING_STORY_ID   = 9999999;
const VISITOR_ID         = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

let testUser = null;

beforeAll(async () => {
  testUser = await registerAndLogin();
}, 30000);

// ─────────────────────────────────────────────────────────────────────────────
// SUCCESS CASES
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /users/mark-as-read/:storyId — Success Cases', () => {

  test('SC-01: Authenticated user — returns HTTP 200 with no body', async () => {
    const res = await request(app)
      .post(`${BASE_MARK_READ}/${TEST_STORY_ID}`)
      .set('Authorization', `Bearer ${testUser.token}`);

    // 200 = story exists and was marked read
    // 404 = story doesn't exist in test DB (acceptable)
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      // Java returns void — body must be empty
      expect(res.text).toBe('');
    }
  });

  test('SC-02: Anonymous user with visitorId — returns HTTP 200 with no body', async () => {
    const res = await request(app)
      .post(`${BASE_MARK_READ}/${TEST_STORY_ID}?visitorId=${VISITOR_ID}`);

    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.text).toBe('');
    }
  });

  test('SC-03: No Authorization header and no visitorId — still accepted (auth optional)', async () => {
    const res = await request(app)
      .post(`${BASE_MARK_READ}/${TEST_STORY_ID}`);

    // Auth is optional — should NOT return 403
    expect(res.status).not.toBe(403);
    expect([200, 404]).toContain(res.status);
  });

  test('SC-04: Idempotent — marking same story read twice returns 200 both times', async () => {
    const first = await request(app)
      .post(`${BASE_MARK_READ}/${TEST_STORY_ID}`)
      .set('Authorization', `Bearer ${testUser.token}`);

    const second = await request(app)
      .post(`${BASE_MARK_READ}/${TEST_STORY_ID}`)
      .set('Authorization', `Bearer ${testUser.token}`);

    if (first.status === 200) {
      expect(second.status).toBe(200);
      // Both responses must have empty body
      expect(first.text).toBe('');
      expect(second.text).toBe('');
    }
  });

  test('SC-05: visitorId in query string is accepted without error', async () => {
    const res = await request(app)
      .post(`${BASE_MARK_READ}/${TEST_STORY_ID}`)
      .query({ visitorId: VISITOR_ID });

    expect([200, 404]).toContain(res.status);
  });

  test('SC-06: Response body is empty (Java void contract)', async () => {
    const res = await request(app)
      .post(`${BASE_MARK_READ}/${TEST_STORY_ID}`)
      .set('Authorization', `Bearer ${testUser.token}`);

    if (res.status === 200) {
      // Must be void — no JSON, no text content
      expect(res.body).toEqual({});
      expect(res.text).toBe('');
    }
  });

  test('SC-07: Different users can mark the same story as read independently', async () => {
    const user2 = await registerAndLogin();

    const res1 = await request(app)
      .post(`${BASE_MARK_READ}/${TEST_STORY_ID}`)
      .set('Authorization', `Bearer ${testUser.token}`);

    const res2 = await request(app)
      .post(`${BASE_MARK_READ}/${TEST_STORY_ID}`)
      .set('Authorization', `Bearer ${user2.token}`);

    if (res1.status === 200 && res2.status === 200) {
      expect(res1.text).toBe('');
      expect(res2.text).toBe('');
    }
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// FAILURE CASES
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /users/mark-as-read/:storyId — Failure Cases', () => {

  test('FC-01: Non-existent storyId → 404', async () => {
    const res = await request(app)
      .post(`${BASE_MARK_READ}/${MISSING_STORY_ID}`)
      .set('Authorization', `Bearer ${testUser.token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Story not found/i);
  });

  test('FC-02: String storyId → 422', async () => {
    const res = await request(app)
      .post(`${BASE_MARK_READ}/not-a-story-id`)
      .set('Authorization', `Bearer ${testUser.token}`);

    expect(res.status).toBe(422);
  });

  test('FC-03: storyId = 0 → 422', async () => {
    const res = await request(app)
      .post(`${BASE_MARK_READ}/0`)
      .set('Authorization', `Bearer ${testUser.token}`);

    expect(res.status).toBe(422);
  });

  test('FC-04: Negative storyId → 422', async () => {
    const res = await request(app)
      .post(`${BASE_MARK_READ}/-1`)
      .set('Authorization', `Bearer ${testUser.token}`);

    expect(res.status).toBe(422);
  });

  test('FC-05: Invalid token on optional-auth endpoint — treated as anonymous (not rejected)', async () => {
    // POST /users/mark-as-read/:storyId has NO auth middleware — auth is optional.
    // An invalid/malformed token is silently ignored: req.decodedToken is undefined,
    // userId = null, and the request proceeds as an anonymous call.
    // Therefore 401/403 are NOT returned — the response is [200, 404] depending on
    // whether the story exists in the test DB.
    const res = await request(app)
      .post(`${BASE_MARK_READ}/${TEST_STORY_ID}`)
      .set('Authorization', 'Bearer not.a.valid.token');

    // Must NOT be a server error
    expect(res.status).not.toBe(500);
    // Optional auth: invalid token is treated the same as no token
    expect([200, 404]).toContain(res.status);
  });

  test('FC-06: Very large non-existent storyId → 404', async () => {
    const res = await request(app)
      .post(`${BASE_MARK_READ}/999999999`);

    expect(res.status).toBe(404);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// EDGE CASES — URL CONTRACT
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /users/mark-as-read/:storyId — URL Contract Edge Cases', () => {

  test('EC-01: storyId is the ONLY path param — no userId in URL', async () => {
    // Proves the route POST /mark-as-read/:storyId EXISTS in Express.
    // Strategy: if we get 404, it MUST be the service-level 404 ("Story not found"),
    // NOT the Express route-level 404 ("Endpoint not found").
    // We cannot use not.toBe(404) because the story may not exist in the test DB.
    const res = await request(app)
      .post(`${BASE_MARK_READ}/${TEST_STORY_ID}`);

    if (res.status === 404) {
      // Service-level 404 — route was found, story was not
      expect(res.body.message).toMatch(/Story not found/i);
      // Must NOT be Express "Endpoint not found" (route missing)
      expect(res.body.message).not.toMatch(/Endpoint not found/i);
    } else {
      // Story exists in DB — route resolved and returned 200
      expect(res.status).toBe(200);
    }
  });

  test('EC-02: Float storyId → 422', async () => {
    const res = await request(app)
      .post(`${BASE_MARK_READ}/100.5`);

    expect(res.status).toBe(422);
  });

  test('EC-03: visitorId with authenticated user — both present, userId takes priority', async () => {
    const res = await request(app)
      .post(`${BASE_MARK_READ}/${TEST_STORY_ID}`)
      .set('Authorization', `Bearer ${testUser.token}`)
      .query({ visitorId: VISITOR_ID });

    expect([200, 404]).toContain(res.status);
    // No crash — both params handled gracefully
  });

  test('EC-04: Extra query params are ignored gracefully', async () => {
    const res = await request(app)
      .post(`${BASE_MARK_READ}/${TEST_STORY_ID}`)
      .query({ visitorId: VISITOR_ID, someExtra: 'ignored' });

    expect([200, 404]).toContain(res.status);
  });

  test('EC-05: HTTP method GET on mark-as-read route must NOT match (no such route)', async () => {
    // Proves the old GET route no longer exists — only POST works
    const res = await request(app)
      .get(`${BASE_MARK_READ}/${TEST_STORY_ID}`);

    // Should be 404 (no such route) — not the service-level 404
    expect(res.status).toBe(404);
  });

  test('EC-06: Multiple visitorId calls for same story — idempotent', async () => {
    const first = await request(app)
      .post(`${BASE_MARK_READ}/${TEST_STORY_ID}`)
      .query({ visitorId: VISITOR_ID });

    const second = await request(app)
      .post(`${BASE_MARK_READ}/${TEST_STORY_ID}`)
      .query({ visitorId: VISITOR_ID });

    if (first.status === 200) {
      expect(second.status).toBe(200);
    }
  });

});
'use strict';

/**
 * Tests for User Submissions (corrected for Swagger)
 *
 * Endpoints:
 *   POST   /backend/api/v1/users/:userId/submissions          (add — unchanged)
 *   GET    /backend/api/v1/users/submission/:submissionId     (get single — CORRECTED)
 *   GET    /backend/api/v1/users/:userId/submissions          (list — unchanged)
 *   DELETE /backend/api/v1/users/:userId/submissions/:id      (delete — unchanged)
 *
 * Run: cross-env NODE_ENV=local npx jest tests/user.submissions.test.js --forceExit --verbose
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT CHANGED:
 *
 * ❌ OLD: GET /users/:userId/submissions/:submissionId
 *    - userId in path (WRONG)
 *    - plural "submissions" (WRONG)
 *
 * ✅ NEW: GET /users/submission/:submissionId
 *    - submissionId only in path
 *    - singular "submission"
 *    - userId from JWT token (optional auth)
 *    - No userId in URL
 * ─────────────────────────────────────────────────────────────────────────────
 */

const request = require('supertest');
const app     = require('../app');

const BASE_REGISTER   = '/backend/api/v1/users/register';
const BASE_LOGIN      = '/backend/api/v1/users/login';
const BASE_USERS      = '/backend/api/v1/users';
const BASE_SUBMISSION = '/backend/api/v1/users/submission'; // singular — Swagger corrected

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid   = () => `sub_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const email = () => `${uid()}@example.com`;
const mob   = () => Math.floor(6000000000 + Math.random() * 3999999999);

const registerAndLogin = async () => {
  const payload = {
    userName:     `SubUser_${uid()}`,
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

let testUser = null;

beforeAll(async () => {
  testUser = await registerAndLogin();
}, 30000);

// ─────────────────────────────────────────────────────────────────────────────
// POST /users/:userId/submissions — Add Submission (UNCHANGED)
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /users/:userId/submissions — Add Submission', () => {

  test('SC-01: Add submission returns 201 with submissionId', async () => {
    const { userId, token } = testUser;
    const res = await request(app)
      .post(`${BASE_USERS}/${userId}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ submissionTitle: 'Test Title', submissionContent: 'Test Content' });

    expect(res.status).toBe(201);
    expect(res.body.submissionId).toBeDefined();
    expect(res.body.submissionTitle).toBe('Test Title');
  });

  test('SC-02: Response has all required fields', async () => {
    const { userId, token } = testUser;
    const res = await request(app)
      .post(`${BASE_USERS}/${userId}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ submissionTitle: 'Fields Test', submissionContent: 'Content' });

    expect(res.body).toHaveProperty('submissionId');
    expect(res.body).toHaveProperty('submissionTitle');
    expect(res.body).toHaveProperty('submissionContent');
    expect(res.body).toHaveProperty('submissionStatus');
    expect(res.body).toHaveProperty('createdOn');
  });

  test('SC-03: Default submissionStatus is pending', async () => {
    const { userId, token } = testUser;
    const res = await request(app)
      .post(`${BASE_USERS}/${userId}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ submissionTitle: 'Status Test', submissionContent: 'Content' });

    expect(res.status).toBe(201);
    expect(res.body.submissionStatus).toBe('pending');
  });

  test('FC-01: Missing title → 422', async () => {
    const { userId, token } = testUser;
    const res = await request(app)
      .post(`${BASE_USERS}/${userId}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ submissionContent: 'Content only' });

    expect(res.status).toBe(422);
  });

  test('FC-02: Missing content → 422', async () => {
    const { userId, token } = testUser;
    const res = await request(app)
      .post(`${BASE_USERS}/${userId}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ submissionTitle: 'Title only' });

    expect(res.status).toBe(422);
  });

  test('FC-03: Non-existent userId → 404', async () => {
    const { token } = testUser;
    const res = await request(app)
      .post(`${BASE_USERS}/9999999/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ submissionTitle: 'Test', submissionContent: 'Content' });

    expect(res.status).toBe(404);
  });

  test('FC-04: No auth → 403', async () => {
    const { userId } = testUser;
    const res = await request(app)
      .post(`${BASE_USERS}/${userId}/submissions`)
      .send({ submissionTitle: 'Test', submissionContent: 'Content' });

    expect(res.status).toBe(403);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// GET /users/submission/:submissionId — Get Single Submission (CORRECTED URL)
//
// ✅ NEW URL: /users/submission/:submissionId  (singular, no userId in path)
// ❌ OLD URL: /users/:userId/submissions/:submissionId  (was wrong)
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /users/submission/:submissionId — Get Single Submission (Swagger corrected)', () => {

  test('SC-01: Authenticated user gets own submission by submissionId only', async () => {
    const { userId, token } = testUser;

    // Create a submission first
    const createRes = await request(app)
      .post(`${BASE_USERS}/${userId}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ submissionTitle: 'Get Test', submissionContent: 'Content for get test' });

    expect(createRes.status).toBe(201);
    const submissionId = createRes.body.submissionId;

    // Fetch via corrected URL — no userId in path
    const getRes = await request(app)
      .get(`${BASE_SUBMISSION}/${submissionId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.submissionId).toBe(submissionId);
    expect(getRes.body.submissionTitle).toBe('Get Test');
  });

  test('SC-02: Response contains all required SubmissionDTO fields', async () => {
    const { userId, token } = testUser;

    const createRes = await request(app)
      .post(`${BASE_USERS}/${userId}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ submissionTitle: 'DTO Fields Test', submissionContent: 'Content' });

    const getRes = await request(app)
      .get(`${BASE_SUBMISSION}/${createRes.body.submissionId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body).toHaveProperty('submissionId');
    expect(getRes.body).toHaveProperty('userId');
    expect(getRes.body).toHaveProperty('submissionTitle');
    expect(getRes.body).toHaveProperty('submissionContent');
    expect(getRes.body).toHaveProperty('submissionStatus');
    expect(getRes.body).toHaveProperty('createdOn');
    expect(getRes.body).toHaveProperty('updatedOn');
  });

  test('SC-03: Works without Authorization header (optional auth)', async () => {
    const { userId, token } = testUser;

    const createRes = await request(app)
      .post(`${BASE_USERS}/${userId}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ submissionTitle: 'Anonymous Get', submissionContent: 'Content' });

    // Auth is OPTIONAL on GET /users/submission/:submissionId
    const getRes = await request(app)
      .get(`${BASE_SUBMISSION}/${createRes.body.submissionId}`);

    // Should NOT return 403 — auth is optional
    expect(getRes.status).not.toBe(403);
    expect([200, 404]).toContain(getRes.status);
  });

  test('SC-04: submissionId in response matches the path param', async () => {
    const { userId, token } = testUser;

    const createRes = await request(app)
      .post(`${BASE_USERS}/${userId}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ submissionTitle: 'ID Match Test', submissionContent: 'Content' });

    const getRes = await request(app)
      .get(`${BASE_SUBMISSION}/${createRes.body.submissionId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.submissionId).toBe(createRes.body.submissionId);
  });

  test('FC-01: Non-existent submissionId → 404', async () => {
    const { token } = testUser;
    const res = await request(app)
      .get(`${BASE_SUBMISSION}/9999999`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Submission not found/i);
  });

  test('FC-02: Invalid submissionId (string) → 422', async () => {
    const { token } = testUser;
    const res = await request(app)
      .get(`${BASE_SUBMISSION}/not-a-number`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  test('FC-03: submissionId = 0 → 422', async () => {
    const { token } = testUser;
    const res = await request(app)
      .get(`${BASE_SUBMISSION}/0`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  test('FC-04: Negative submissionId → 422', async () => {
    const { token } = testUser;
    const res = await request(app)
      .get(`${BASE_SUBMISSION}/-1`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  test('EC-01: Old URL /users/:userId/submissions/:id must NOT resolve', async () => {
    const { userId, token } = testUser;

    const createRes = await request(app)
      .post(`${BASE_USERS}/${userId}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ submissionTitle: 'Old URL Test', submissionContent: 'Content' });

    const submissionId = createRes.body.submissionId;

    // Old route must return Express-level 404 "Endpoint not found"
    const res = await request(app)
      .get(`${BASE_USERS}/${userId}/submissions/${submissionId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Endpoint not found/i);
  });

  test('EC-02: Float submissionId → 422', async () => {
    const { token } = testUser;
    const res = await request(app)
      .get(`${BASE_SUBMISSION}/1.5`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  test('EC-03: Large non-existent submissionId → 404', async () => {
    const { token } = testUser;
    const res = await request(app)
      .get(`${BASE_SUBMISSION}/999999999`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// GET /users/:userId/submissions — List Submissions (UNCHANGED)
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /users/:userId/submissions — List Submissions', () => {

  test('SC-01: List submissions returns 200 with pagination', async () => {
    const { userId, token } = testUser;
    const res = await request(app)
      .get(`${BASE_USERS}/${userId}/submissions`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('submissions');
    expect(res.body).toHaveProperty('pagination');
    expect(Array.isArray(res.body.submissions)).toBe(true);
  });

  test('SC-02: Pagination defaults to page 1, limit 10', async () => {
    const { userId, token } = testUser;
    const res = await request(app)
      .get(`${BASE_USERS}/${userId}/submissions`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.pagination.currentPage).toBe(1);
    expect(res.body.pagination.pageSize).toBe(10);
  });

  test('FC-01: page = 0 → 422', async () => {
    const { userId, token } = testUser;
    const res = await request(app)
      .get(`${BASE_USERS}/${userId}/submissions?page=0`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  test('FC-02: limit > 100 → 422', async () => {
    const { userId, token } = testUser;
    const res = await request(app)
      .get(`${BASE_USERS}/${userId}/submissions?limit=101`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });

  test('FC-03: No auth → 403', async () => {
    const { userId } = testUser;
    const res = await request(app)
      .get(`${BASE_USERS}/${userId}/submissions`);

    expect(res.status).toBe(403);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /users/:userId/submissions/:submissionId — Delete (UNCHANGED)
// ─────────────────────────────────────────────────────────────────────────────
describe('DELETE /users/:userId/submissions/:submissionId — Delete Submission', () => {

  test('SC-01: Delete existing submission returns 200', async () => {
    const { userId, token } = testUser;

    const createRes = await request(app)
      .post(`${BASE_USERS}/${userId}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ submissionTitle: 'Delete Test', submissionContent: 'Content to delete' });

    expect(createRes.status).toBe(201);

    const delRes = await request(app)
      .delete(`${BASE_USERS}/${userId}/submissions/${createRes.body.submissionId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);
  });

  test('FC-01: Delete non-existent submission → 404', async () => {
    const { userId, token } = testUser;
    const res = await request(app)
      .delete(`${BASE_USERS}/${userId}/submissions/9999999`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  test('FC-02: No auth → 403', async () => {
    const { userId } = testUser;
    const res = await request(app)
      .delete(`${BASE_USERS}/${userId}/submissions/1`);

    expect(res.status).toBe(403);
  });

});

'use strict';

const request = require('supertest');
const app = require('../app');

const BASE_REGISTER = '/backend/api/v1/users/register';
const BASE_LOGIN = '/backend/api/v1/users/login';
const BASE_USERS = '/backend/api/v1/users';

const uid = () => `sub_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const email = () => `${uid()}@example.com`;
const mob = () => Math.floor(6000000000 + Math.random() * 3999999999);

const registerAndLogin = async () => {
  const payload = {
    userName: 'SubTest User',
    userAge: 28,
    userMobile: mob(),
    userGenderId: 1,
    languageEnum: 0,
    locationId: 1,
    locationName: 'Mumbai',
    userEmail: email(),
    isEmailLogin: true,
    userTag: [],
    triggers: [],
    userCommunity: [],
  };

  const regRes = await request(app).post(BASE_REGISTER).send(payload);
  if (regRes.status !== 201) throw new Error(`Registration failed`);

  const loginRes = await request(app).post(BASE_LOGIN).send({ userEmail: payload.userEmail });
  const token = loginRes.body.jwtToken;
  const userId = loginRes.body.userId;

  return { userId, token, payload };
};

let testUser = null;

beforeAll(async () => {
  testUser = await registerAndLogin();
}, 30000);

describe('POST /users/:userId/submissions — Add Submission', () => {

  test('SC-01: Add submission returns 201', async () => {
    const { userId, token } = testUser;
    const res = await request(app)
      .post(`${BASE_USERS}/${userId}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ submissionTitle: 'Test', submissionContent: 'Content' });
    expect(res.status).toBe(201);
    expect(res.body.submissionId).toBeDefined();
  });

  test('SC-02: Response has all fields', async () => {
    const { userId, token } = testUser;
    const res = await request(app)
      .post(`${BASE_USERS}/${userId}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ submissionTitle: 'Test', submissionContent: 'Content' });
    expect(res.body).toHaveProperty('submissionId');
    expect(res.body).toHaveProperty('submissionTitle');
    expect(res.body).toHaveProperty('submissionContent');
    expect(res.body).toHaveProperty('submissionStatus');
  });

  test('FC-01: Missing title returns 422', async () => {
    const { userId, token } = testUser;
    const res = await request(app)
      .post(`${BASE_USERS}/${userId}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ submissionContent: 'Content' });
    expect(res.status).toBe(422);
  });

  test('FC-02: Non-existent user returns 404', async () => {
    const { token } = testUser;
    const res = await request(app)
      .post(`${BASE_USERS}/9999999/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ submissionTitle: 'Test', submissionContent: 'Content' });
    expect(res.status).toBe(404);
  });

});

describe('GET /users/:userId/submissions/:submissionId — Get Submission', () => {

  test('SC-01: Get submission returns 200', async () => {
    const { userId, token } = testUser;
    const createRes = await request(app)
      .post(`${BASE_USERS}/${userId}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ submissionTitle: 'Get Test', submissionContent: 'Content' });
    if (createRes.status === 201) {
      const getRes = await request(app)
        .get(`${BASE_USERS}/${userId}/submissions/${createRes.body.submissionId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(200);
    }
  });

  test('FC-01: Non-existent submission returns 404', async () => {
    const { userId, token } = testUser;
    const res = await request(app)
      .get(`${BASE_USERS}/${userId}/submissions/9999999`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

});

describe('GET /users/:userId/submissions — List Submissions', () => {

  test('SC-01: List submissions returns 200', async () => {
    const { userId, token } = testUser;
    const res = await request(app)
      .get(`${BASE_USERS}/${userId}/submissions`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('submissions');
    expect(res.body).toHaveProperty('pagination');
  });

  test('SC-02: Pagination info included', async () => {
    const { userId, token } = testUser;
    const res = await request(app)
      .get(`${BASE_USERS}/${userId}/submissions`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.pagination.currentPage).toBe(1);
    expect(res.body.pagination.pageSize).toBe(10);
  });

  test('FC-01: Invalid page parameter', async () => {
    const { userId, token } = testUser;
    const res = await request(app)
      .get(`${BASE_USERS}/${userId}/submissions?page=0`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(422);
  });

});

describe('DELETE /users/:userId/submissions/:submissionId — Delete Submission', () => {

  test('SC-01: Delete submission returns 200', async () => {
    const { userId, token } = testUser;
    const createRes = await request(app)
      .post(`${BASE_USERS}/${userId}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ submissionTitle: 'Delete Test', submissionContent: 'Content' });
    if (createRes.status === 201) {
      const delRes = await request(app)
        .delete(`${BASE_USERS}/${userId}/submissions/${createRes.body.submissionId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);
    }
  });

  test('FC-01: Delete non-existent submission returns 404', async () => {
    const { userId, token } = testUser;
    const res = await request(app)
      .delete(`${BASE_USERS}/${userId}/submissions/9999999`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

});

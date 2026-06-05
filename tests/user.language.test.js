'use strict';

const request = require('supertest');
const app = require('../app');

const BASE_REGISTER = '/backend/api/v1/users/register';
const BASE_LOGIN = '/backend/api/v1/users/login';
const BASE_USERS = '/backend/api/v1/users';

const uid = () => `lang_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const email = () => `${uid()}@example.com`;
const mob = () => Math.floor(6000000000 + Math.random() * 3999999999);

const registerAndLogin = async (langOverride = 0) => {
  const payload = {
    userName: 'LangTest User',
    userAge: 28,
    userMobile: mob(),
    userGenderId: 1,
    languageEnum: langOverride,
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

let englishUser = null;
let hindiUser = null;

beforeAll(async () => {
  englishUser = await registerAndLogin(0);
  hindiUser = await registerAndLogin(1);
}, 30000);

describe('PATCH /users/:userId/language — Success Cases', () => {

  test('SC-01: Change language from ENGLISH to HINDI', async () => {
    const { userId, token } = englishUser;

    const res = await request(app)
      .patch(`${BASE_USERS}/${userId}/language`)
      .set('Authorization', `Bearer ${token}`)
      .send({ languageEnum: 1 });

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(userId);
    expect(res.body.languageEnum).toBe(1);
    expect(res.body.message).toMatch(/HINDI/i);
  });

  test('SC-02: Change language from HINDI to ENGLISH', async () => {
    const { userId, token } = hindiUser;

    const res = await request(app)
      .patch(`${BASE_USERS}/${userId}/language`)
      .set('Authorization', `Bearer ${token}`)
      .send({ languageEnum: 0 });

    expect(res.status).toBe(200);
    expect(res.body.languageEnum).toBe(0);
    expect(res.body.message).toMatch(/ENGLISH/i);
  });

  test('SC-03: Response contains userId, userName, language, message', async () => {
    const user = await registerAndLogin();

    const res = await request(app)
      .patch(`${BASE_USERS}/${user.userId}/language`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ languageEnum: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('userId');
    expect(res.body).toHaveProperty('userName');
    expect(res.body).toHaveProperty('languageEnum');
    expect(res.body).toHaveProperty('message');
  });

  test('SC-04: Language 0 (ENGLISH) is accepted', async () => {
    const user = await registerAndLogin(1);

    const res = await request(app)
      .patch(`${BASE_USERS}/${user.userId}/language`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ languageEnum: 0 });

    expect(res.status).toBe(200);
    expect(res.body.languageEnum).toBe(0);
  });

  test('SC-05: Language 1 (HINDI) is accepted', async () => {
    const user = await registerAndLogin(0);

    const res = await request(app)
      .patch(`${BASE_USERS}/${user.userId}/language`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ languageEnum: 1 });

    expect(res.status).toBe(200);
    expect(res.body.languageEnum).toBe(1);
  });

  test('SC-06: Setting same language twice works (idempotent)', async () => {
    const user = await registerAndLogin(0);

    const res1 = await request(app)
      .patch(`${BASE_USERS}/${user.userId}/language`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ languageEnum: 0 });

    const res2 = await request(app)
      .patch(`${BASE_USERS}/${user.userId}/language`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ languageEnum: 0 });

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body.languageEnum).toBe(res2.body.languageEnum);
  });

});

describe('PATCH /users/:userId/language — Failure Cases', () => {

  test('FC-01: Non-existent userId → 404', async () => {
    const { token } = englishUser;

    const res = await request(app)
      .patch(`${BASE_USERS}/9999999/language`)
      .set('Authorization', `Bearer ${token}`)
      .send({ languageEnum: 1 });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/User not found/i);
  });

  test('FC-02: No Authorization header → 403', async () => {
    const { userId } = englishUser;

    const res = await request(app)
      .patch(`${BASE_USERS}/${userId}/language`)
      .send({ languageEnum: 1 });

    expect(res.status).toBe(403);
  });

  test('FC-03: Invalid userId (string) → 422', async () => {
    const { token } = englishUser;

    const res = await request(app)
      .patch(`${BASE_USERS}/not-an-id/language`)
      .set('Authorization', `Bearer ${token}`)
      .send({ languageEnum: 1 });

    expect(res.status).toBe(422);
  });

  test('FC-04: Invalid languageEnum (2) → 422', async () => {
    const { userId, token } = englishUser;

    const res = await request(app)
      .patch(`${BASE_USERS}/${userId}/language`)
      .set('Authorization', `Bearer ${token}`)
      .send({ languageEnum: 2 });

    expect(res.status).toBe(422);
  });

  test('FC-05: Invalid languageEnum (negative) → 422', async () => {
    const { userId, token } = englishUser;

    const res = await request(app)
      .patch(`${BASE_USERS}/${userId}/language`)
      .set('Authorization', `Bearer ${token}`)
      .send({ languageEnum: -1 });

    expect(res.status).toBe(422);
  });

  test('FC-06: Missing languageEnum → 422', async () => {
    const { userId, token } = englishUser;

    const res = await request(app)
      .patch(`${BASE_USERS}/${userId}/language`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
  });

  test('FC-07: Invalid token → 401', async () => {
    const { userId } = englishUser;

    const res = await request(app)
      .patch(`${BASE_USERS}/${userId}/language`)
      .set('Authorization', 'Bearer invalid.token.here')
      .send({ languageEnum: 1 });

    expect([401, 403]).toContain(res.status);
  });

  test('FC-08: valid languageEnum number', async () => {
    const { userId, token } = englishUser;

    const res = await request(app)
      .patch(`${BASE_USERS}/${userId}/language`)
      .set('Authorization', `Bearer ${token}`)
      .send({ languageEnum: 1 });

    expect(res.status).toBe(200);
  });

});

describe('PATCH /users/:userId/language — Edge Cases', () => {

  test('EC-01: userId=0 → 422', async () => {
    const { token } = englishUser;

    const res = await request(app)
      .patch(`${BASE_USERS}/0/language`)
      .set('Authorization', `Bearer ${token}`)
      .send({ languageEnum: 1 });

    expect(res.status).toBe(422);
  });

  test('EC-02: Large userId (not found) → 404', async () => {
    const { token } = englishUser;

    const res = await request(app)
      .patch(`${BASE_USERS}/999999999/language`)
      .set('Authorization', `Bearer ${token}`)
      .send({ languageEnum: 1 });

    expect(res.status).toBe(404);
  });

  test('EC-03: Multiple rapid updates work correctly', async () => {
    const user = await registerAndLogin(0);

    const r1 = await request(app)
      .patch(`${BASE_USERS}/${user.userId}/language`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ languageEnum: 1 });

    const r2 = await request(app)
      .patch(`${BASE_USERS}/${user.userId}/language`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ languageEnum: 0 });

    const r3 = await request(app)
      .patch(`${BASE_USERS}/${user.userId}/language`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ languageEnum: 1 });

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(200);
    expect(r1.body.languageEnum).toBe(1);
    expect(r2.body.languageEnum).toBe(0);
    expect(r3.body.languageEnum).toBe(1);
  });

  test('EC-04: Response format is consistent', async () => {
    const user = await registerAndLogin();

    const res = await request(app)
      .patch(`${BASE_USERS}/${user.userId}/language`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ languageEnum: 1 });

    expect(res.status).toBe(200);
    expect(typeof res.body.userId).toBe('number');
    expect(typeof res.body.userName).toBe('string');
    expect(typeof res.body.languageEnum).toBe('number');
    expect(typeof res.body.message).toBe('string');
  });

});

describe('PATCH /users/:userId/language — Persistence', () => {

  test('PS-01: Language change persists after update', async () => {
    const user = await registerAndLogin(0);

    const updateRes = await request(app)
      .patch(`${BASE_USERS}/${user.userId}/language`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ languageEnum: 1 });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.languageEnum).toBe(1);

    const getRes = await request(app)
      .get(`${BASE_USERS}/${user.userId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.languageEnum).toBe(1);
  });

});

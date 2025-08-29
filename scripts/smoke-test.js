const fetch = require('node-fetch');
let firebaseConfig;
try {
  if (process.env.USE_LOCAL_FIREBASE_CONFIG) {
    firebaseConfig = require('../firebase-config.test').firebaseConfig;
  } else {
    firebaseConfig = require('../firebase-config').firebaseConfig;
  }
} catch (e) {
  // fallback para arquivo de teste
  try { firebaseConfig = require('../firebase-config.test').firebaseConfig; } catch (e2) { throw e; }
}

const apiKey = firebaseConfig.apiKey;
const projectId = firebaseConfig.projectId;

// Proteção: evitar executar o smoke-test contra projeto real por engano.
// Para permitir execuções intencionais contra produção, defina a variável de ambiente
// ALLOW_SMOKE_REMOTE=1 ao executar o script.
if (!process.env.ALLOW_SMOKE_REMOTE) {
  if (projectId && !String(projectId).includes('emulator') && !String(projectId).includes('local')) {
    console.error('smoke-test abortado: projeto parece ser remoto. Para permitir, configure ALLOW_SMOKE_REMOTE=1');
    process.exit(1);
  }
}

async function signUp(email, password) {
  // In emulator mode, call the Auth emulator REST endpoint so we obtain a valid idToken
  if (process.env.USE_LOCAL_FIREBASE_CONFIG) {
    const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';
    const base = `http://${authHost}/identitytoolkit.googleapis.com/v1`;
    const url = `${base}/accounts:signUp?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    return res.json();
  }
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  return res.json();
}

async function signIn(email, password) {
  if (process.env.USE_LOCAL_FIREBASE_CONFIG) {
    const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';
    const base = `http://${authHost}/identitytoolkit.googleapis.com/v1`;
    const url = `${base}/accounts:signInWithPassword?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    return res.json();
  }
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  return res.json();
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(v => toFirestoreValue(v)) } };
  }
  if (typeof value === 'object') {
    // mapValue
    const fields = {};
    for (const [k, v] of Object.entries(value)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === 'number') return { doubleValue: value };
  // fallback para string
  return { stringValue: String(value) };
}

async function createEvent(idToken, eventoId, data) {
  let url;
  if (process.env.USE_LOCAL_FIREBASE_CONFIG) {
    // Firestore emulator REST endpoint
    url = `http://localhost:8080/v1/projects/${projectId}/databases/(default)/documents/eventos?documentId=${eventoId}`;
  } else {
    url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/eventos?documentId=${eventoId}`;
  }
  const body = {
    fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toFirestoreValue(v)]))
  };
  console.log('Firestore REST body:', JSON.stringify(body, null, 2));
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
    },
  body: JSON.stringify(body)
  });
  return res;
}

(async () => {
  const testEmail = `smoketest+${Date.now()}@example.com`;
  const testPass = 'pass1234';
  console.log('Criando usuário:', testEmail);
  const signup = await signUp(testEmail, testPass);
  if (signup.error) { console.error('Erro signup', signup.error); return; }
  console.log('signup ok, uid:', signup.localId);

  const signin = await signIn(testEmail, testPass);
  if (signin.error) { console.error('Erro signin', signin.error); return; }
  console.log('signin ok, idToken length:', (signin.idToken || '').length);

  const eventoId = 'smoke-' + Date.now();
  const eventData = { infoGerais: { 'evento-nome': 'Smoke Event' }, ownerUid: signin.localId };

  console.log('Tentando criar evento autenticado...');
  const resAuth = await createEvent(signin.idToken, eventoId, eventData);
  console.log('Status (autenticado):', resAuth.status);
  const textAuth = await resAuth.text();
  console.log(textAuth);

  console.log('Tentando criar evento sem autenticação (deve falhar)...');
  const resNoAuth = await createEvent(null, eventoId + '-noauth', eventData);
  console.log('Status (no auth):', resNoAuth.status);
  const textNoAuth = await resNoAuth.text();
  console.log(textNoAuth);
})();

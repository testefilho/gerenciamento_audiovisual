const fetch = require('node-fetch');

async function createAuthUser(email, password) {
  const url = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-emulator-key';
  const body = { email, password, returnSecureToken: true };
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await res.json();
  console.log('createAuthUser status=', res.status, j);
  return { status: res.status, body: j };
}

async function createEventViaRest(eventId, ownerUid, idToken) {
  const projectId = 'evento-producao-emulator';
  const url = `http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents/eventos?documentId=${eventId}`;
  const headers = { 'Content-Type': 'application/json' };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  const body = {
    fields: {
      ownerUid: { stringValue: ownerUid },
      infoGerais: { mapValue: { fields: { 'evento-nome': { stringValue: 'E2E REST Validate Event' } } } },
      ultimaAtualizacao: { timestampValue: new Date().toISOString() }
    }
  };
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const txt = await res.text();
  console.log('createEventViaRest status=', res.status, 'body=', txt);
  return { status: res.status, body: txt };
}

async function createCronogramaViaRest(eventId, ownerUid, idToken) {
  const projectId = 'evento-producao-emulator';
  const url = `http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents/eventos/${eventId}/cronograma`;
  const headers = { 'Content-Type': 'application/json' };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  const body = {
    fields: {
      horario: { stringValue: '' },
      acao: { stringValue: 'Nova Atividade (REST validate)' },
      tipo: { stringValue: 'outro' },
      observacoes: { stringValue: '' },
      timestamp: { timestampValue: new Date().toISOString() },
      ownerUid: { stringValue: ownerUid }
    }
  };
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const txt = await res.text();
  console.log('createCronogramaViaRest status=', res.status, 'body=', txt);
  return { status: res.status, body: txt };
}

(async () => {
  const email = 'e2e+rest@local.test';
  const pass = 'senha123';
  const user = await createAuthUser(email, pass);
  if (user.status !== 200) return process.exit(2);
  const idToken = user.body.idToken;
  const localId = user.body.localId;
  const eventId = 'e2e-rest-validate';
  const ev = await createEventViaRest(eventId, localId, idToken);
  const cr = await createCronogramaViaRest(eventId, localId, idToken);
  if (cr.status === 200 || cr.status === 201) {
    console.log('REST validation succeeded');
    process.exit(0);
  }
  console.error('REST validation failed');
  process.exit(3);
})();

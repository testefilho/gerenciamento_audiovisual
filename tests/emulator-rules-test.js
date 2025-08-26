const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { getFirestore } = require('firebase-admin/firestore');

(async () => {
  // Carregar regras locais
  const rules = fs.readFileSync('firestore.rules', 'utf8');

  const testEnv = await initializeTestEnvironment({
    projectId: 'evento-producao-emulator',
    firestore: { rules },
  });

  try {
    // Contexto autenticado (uid 'alice')
    const alice = testEnv.authenticatedContext('alice', { email: 'alice@example.com' });
    const dbAlice = alice.firestore();

    // Contexto não autenticado
    const unauth = testEnv.unauthenticatedContext();
    const dbUnauth = unauth.firestore();

    // Tentativa: criação autenticada deve passar
    console.log('Tentando criação autenticada (alice) ...');
    await assertSucceeds(dbAlice.collection('eventos').doc('em-alice').set({ ownerUid: 'alice', infoGerais: { 'evento-nome': 'Teste' } }));
    console.log('OK: criação autenticada permitida');

    // Tentativa: criação sem autenticação deve falhar
    console.log('Tentando criação sem autenticação ...');
    await assertFails(dbUnauth.collection('eventos').doc('em-unauth').set({ ownerUid: 'nobody', infoGerais: { 'evento-nome': 'Teste' } }));
    console.log('OK: criação sem autenticação negada');

    // Subcoleção cronograma: alice cria item — deve passar
  console.log('Tentando criar cronograma como alice...');
  await assertSucceeds(dbAlice.collection('eventos').doc('em-alice').collection('cronograma').add({ ownerUid: 'alice', acao: 'Ação teste', horario: '12:00', tipo: 'outro', observacoes: '' }));
    console.log('OK: cronograma criado por owner');

    // Subcoleção cronograma: outro usuário (bob) deve falhar
    const bob = testEnv.authenticatedContext('bob', { email: 'bob@example.com' });
    const dbBob = bob.firestore();
  console.log('Tentando criar cronograma como bob (deve falhar)...');
  await assertFails(dbBob.collection('eventos').doc('em-alice').collection('cronograma').add({ ownerUid: 'bob', acao: 'Ação invasora', horario: '12:05', tipo: 'outro', observacoes: '' }));
    console.log('OK: criação por outro usuário negada');

    console.log('Todos os testes do emulator passaram.');
  } catch (err) {
    console.error('Erro nos testes do emulator:', err);
    process.exitCode = 2;
  } finally {
    await testEnv.cleanup();
  }
})();

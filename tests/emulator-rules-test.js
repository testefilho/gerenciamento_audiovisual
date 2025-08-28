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

  // Caso extra: criação de vídeo pelo owner (deve passar)
  console.log('Tentando criar vídeo como alice...');
  await assertSucceeds(dbAlice.collection('eventos').doc('em-alice').collection('videos').add({ ownerUid: 'alice', descricao: 'Vídeo de teste', status: 'pendente' }));
  console.log('OK: vídeo criado por owner');

  // Caso extra: criação de vídeo por bob (deve falhar)
  console.log('Tentando criar vídeo como bob (deve falhar)...');
  await assertFails(dbBob.collection('eventos').doc('em-alice').collection('videos').add({ ownerUid: 'bob', descricao: 'Vídeo invasor', status: 'pendente' }));
  console.log('OK: criação de vídeo por outro usuário negada');

  // Caso extra: cronograma inválido (faltando 'acao') deve falhar
  console.log('Tentando criar cronograma inválido (sem acao) como alice (deve falhar)...');
  await assertFails(dbAlice.collection('eventos').doc('em-alice').collection('cronograma').add({ ownerUid: 'alice', horario: '10:00' }));
  console.log('OK: cronograma inválido negado');

  // Caso extra: vídeo com status inválido deve falhar
  console.log('Tentando criar vídeo com status inválido como alice (deve falhar)...');
  await assertFails(dbAlice.collection('eventos').doc('em-alice').collection('videos').add({ ownerUid: 'alice', descricao: 'Vídeo ruim', status: 'invalido-status' }));
  console.log('OK: vídeo com status inválido negado');

  // Testes de update/delete
  // Owner atualiza informações do evento (deve passar)
  console.log('Tentando atualizar evento como owner (alice)...');
  await assertSucceeds(dbAlice.collection('eventos').doc('em-alice').update({ ownerUid: 'alice', infoGerais: { 'evento-nome': 'Teste atualizado', 'evento-data': null, 'local': null, 'descricao': null }, ultimaAtualizacao: null }));
  console.log('OK: owner atualizou evento');

  // Owner tenta mudar ownerUid (deve falhar)
  console.log('Tentando alterar ownerUid do evento como alice (deve falhar)...');
  await assertFails(dbAlice.collection('eventos').doc('em-alice').update({ ownerUid: 'intruso' }));
  console.log('OK: alteração de ownerUid negada');

  // Outro usuário tenta deletar o evento (deve falhar)
  console.log('Tentando deletar evento como bob (deve falhar)...');
  await assertFails(dbBob.collection('eventos').doc('em-alice').delete());
  console.log('OK: delete por outro usuário negado');

  // Owner deleta o evento (deve passar)
  console.log('Tentando deletar evento como owner (alice)...');
  await assertSucceeds(dbAlice.collection('eventos').doc('em-alice').delete());
  console.log('OK: evento deletado pelo owner');

  console.log('Todos os testes do emulator passaram.');
  } catch (err) {
    console.error('Erro nos testes do emulator:', err);
    process.exitCode = 2;
  } finally {
    await testEnv.cleanup();
  }
})();

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

async function run() {
  // Conectar ao emulador
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

  // Inicializar Admin SDK (usa credenciais default para emulador)
  initializeApp({ projectId: 'evento-producao-emulator' });
  const db = getFirestore();

  const eventoId = 'test-integration-' + Date.now();
  console.log('Criando evento:', eventoId);
  await db.collection('eventos').doc(eventoId).set({ infoGerais: { 'evento-nome': 'Integration Test' }, ownerUid: 'alice' });

  console.log('Adicionando cronograma');
  const cronRef = await db.collection('eventos').doc(eventoId).collection('cronograma').add({ ownerUid: 'alice', acao: 'Teste', horario: '10:00', tipo: 'outro', timestamp: new Date() });

  console.log('Adicionando vídeo');
  const vidRef = await db.collection('eventos').doc(eventoId).collection('videos').add({ ownerUid: 'alice', descricao: 'Vídeo teste', status: 'pendente', timestamp: new Date() });

  console.log('Atualizando status do vídeo');
  await db.collection('eventos').doc(eventoId).collection('videos').doc(vidRef.id).update({ status: 'aprovado' });

  console.log('Adicionando membro equipe');
  await db.collection('eventos').doc(eventoId).collection('equipe').add({ 'membro-nome': 'Tester', 'membro-funcao': 'Produtor', ownerUid: 'alice', timestamp: new Date() });

  console.log('Adicionando entrega');
  await db.collection('eventos').doc(eventoId).collection('entregas').add({ 'entrega-titulo': 'Entrega Teste', 'entrega-prazo': '2025-12-31', 'entrega-status': 'pendente', timestamp: new Date() });

  console.log('Lendo dados...');
  const doc = await db.collection('eventos').doc(eventoId).get();
  console.log('Evento salvo:', doc.exists);

  console.log('Integração local finalizada com sucesso.');
}

run().catch(err => { console.error('Erro no teste de integração local:', err); process.exitCode = 2; });

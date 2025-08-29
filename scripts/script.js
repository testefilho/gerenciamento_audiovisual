// Importações do Firebase (modular SDK v9)
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query as fsQuery,
    where,
    orderBy,
    limit,
    serverTimestamp,
    getDocs
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

// Inicialização do Firestore (o app deve ser inicializado em index.html antes deste módulo)
const db = getFirestore();

// Tornar algumas funções/utilitários acessíveis globalmente para testes E2E e integrações
try {
    if (typeof window !== 'undefined') {
    // expose the initialized auth instance and a getter for compat with tests
    window.auth = auth;
    window.getAuth = () => auth;
        window.signInWithEmailAndPassword = signInWithEmailAndPassword;
        window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
        window.signOut = signOut;
        window.serverTimestamp = serverTimestamp;
        window.firebaseDb = db;
    // permitir reinicializar listeners em E2E quando necessário
    window.iniciarListenersTempoReal = iniciarListenersTempoReal;
    // expor AppState para testes controlarem contexto (apenas em dev/local)
    try { window.AppState = AppState; } catch (e) {}
    }
} catch (e) {
    // ambiente não-browser — ignorar
}

// Estado centralizado da aplicação
const AppState = {
    eventoId: null,
    eventoData: null,
    cronograma: [],
    videos: [],
    unsubscribeCronograma: null,
    unsubscribeVideos: null,
    unsubscribeEquipe: null,
    unsubscribeEntregas: null,
    user: null,
    subscribers: [],

    setEvento(eventoId, data) {
        this.eventoId = eventoId;
        this.eventoData = data || null;
        this.notify();
    },

    setCronograma(items) {
        this.cronograma = items;
        this.notify();
    },

    setVideos(items) {
        this.videos = items;
        this.notify();
    },

    subscribe(fn) {
        this.subscribers.push(fn);
    },

    notify() {
        this.subscribers.forEach(fn => {
            try { fn(this); } catch (e) { console.error('AppState subscriber error', e); }
        });
    }
};

// Autenticação (tenta signin anônimo e mantém estado)
const auth = getAuth();

async function initAuth() {
    try {
        // Tenta autenticar anonimamente — não será necessário se já estiver autenticado
        await signInAnonymously(auth).catch(() => {});
    } catch (e) {
        console.warn('Falha ao tentar signin anônimo', e);
    }

    onAuthStateChanged(auth, (user) => {
        AppState.user = user || null;
        // Atualizar indicador UI de autenticação
        const authEl = document.getElementById('auth-status');
        if (authEl) {
            if (user) authEl.textContent = '(autenticação: ok)';
            else authEl.textContent = '(autenticação: não autenticado)';
        }
        // Atualizar botões de sessão
        const signoutBtn = document.getElementById('btn-signout');
        const signinBtn = document.getElementById('btn-signin');
        const signupBtn = document.getElementById('btn-signup');
        if (user) {
            if (signoutBtn) signoutBtn.classList.remove('hidden');
            if (signinBtn) signinBtn.classList.add('hidden');
            if (signupBtn) signupBtn.classList.add('hidden');
        } else {
            if (signoutBtn) signoutBtn.classList.add('hidden');
            if (signinBtn) signinBtn.classList.remove('hidden');
            if (signupBtn) signupBtn.classList.remove('hidden');
        }
        if (!user) console.warn('Usuário não autenticado');
    });
}

// Cria usuário com email/senha
async function signupWithEmail(email, password) {
    try {
        await createUserWithEmailAndPassword(auth, email, password);
        showNotification('Conta criada e autenticada');
    } catch (e) {
        console.error('Erro signup:', e);
        showNotification('Erro ao criar conta: ' + (e.message || e), true);
    }
}

// Login com email/senha
async function signinWithEmail(email, password) {
    try {
        await signInWithEmailAndPassword(auth, email, password);
        showNotification('Autenticado com sucesso');
    } catch (e) {
        console.error('Erro signin:', e);
        showNotification('Erro ao autenticar: ' + (e.message || e), true);
    }
}

// Sign out
async function signoutCurrent() {
    try {
        await signOut(auth);
        showNotification('Sessão encerrada');
    } catch (e) {
        console.error('Erro signout:', e);
        showNotification('Erro ao sair: ' + (e.message || e), true);
    }
}

// Função para tentar reautenticação manualmente (chamada pelo botão)
async function reauth() {
    try {
        const authEl = document.getElementById('auth-status');
        if (authEl) authEl.textContent = '(autenticação: tentando...)';
        await signInAnonymously(auth);
        showNotification('Tentativa de autenticação iniciada');
    } catch (e) {
        console.error('Erro durante reautenticação: ', e);
        showNotification('Erro ao tentar reautenticar', true);
    }
}

function requireAuth() {
    console.log('requireAuth: AppState.user=', AppState.user);
    if (AppState.user) return true;
    showNotification('Autentique-se para executar esta ação (recarregue a página para tentar autenticação).', true);
    return false;
}

// Função para sanitizar o nome do evento para uso como ID
function sanitizeEventId(nome) {
    return nome
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .substring(0, 50); // Limita o comprimento para evitar problemas
}

// Validação leve do formulário de informações gerais
function validateInfoGerais(data) {
    if (!data['evento-nome'] || String(data['evento-nome']).trim().length < 3) {
        return { ok: false, msg: 'Nome do evento é obrigatório e deve ter ao menos 3 caracteres.' };
    }
    // Se houver data, checar formato simples YYYY-MM-DD (browser já protege)
    if (data['evento-data'] && !/^\d{4}-\d{2}-\d{2}$/.test(data['evento-data'])) {
        return { ok: false, msg: 'Data do evento inválida.' };
    }
    return { ok: true };
}

// Validação leve para formulário de vídeo
function validateVideo(data) {
    if (!data['video-categoria'] || !data['video-tipo']) {
        return { ok: false, msg: 'Categoria e tipo do vídeo são obrigatórios.' };
    }
    if (!data['video-descricao'] || String(data['video-descricao']).trim().length < 5) {
        return { ok: false, msg: 'Descrição do vídeo é obrigatória (mínimo 5 caracteres).' };
    }
    return { ok: true };
}

// Função para exibir notificações
function showNotification(message, isError = false) {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notification-text');
    if (!notification || !notificationText) {
        // Fallback para quando a UI não estiver presente (ex: testes automatizados)
        if (isError) console.error('NOTIFICATION:', message);
        else console.info('NOTIFICATION:', message);
        return;
    }

    notificationText.textContent = message;
    notification.classList.remove('hidden');

    try {
        if (isError) {
            notification.style.background = 'var(--cor-erro)';
        } else {
            notification.style.background = 'var(--cor-sucesso)';
        }
    } catch (e) {
        // ignora estilos se não aplicáveis
    }

    setTimeout(() => {
        try { notification.classList.add('hidden'); } catch (e) {}
    }, 3000);
}

// Função para atualizar a UI com os dados do evento
function updateUIWithEventData(data) {
    if (!data) return;

    // Preencher formulário de informações gerais (data pode vir dentro de infoGerais)
    const info = data.infoGerais || data;
    const form = document.getElementById('form-info-gerais');
    if (form && info) {
        Object.keys(info).forEach(key => {
            const input = form.elements.namedItem(key);
            if (input) input.value = info[key] === undefined ? '' : info[key];
        });
    }

    // Atualizar nome do evento no cabeçalho
    document.getElementById('evento-nome').textContent = (info && info['evento-nome']) || 'Evento';
}

// Função para salvar informações gerais do evento
async function salvarInformacoesGerais(e) {
    e.preventDefault();
    if (!requireAuth()) return;
    
    const form = e.target;
    if (!form) { showNotification('Formulário não encontrado', true); return; }
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    // Validação leve
    const valid = validateInfoGerais(data);
    if (!valid.ok) { showNotification(valid.msg, true); return; }
    
    // Atualizar ID do evento
    const newEventoId = sanitizeEventId(data['evento-nome']);
    AppState.eventoId = newEventoId;
    
    
    // Atualizar UI
    document.getElementById('evento-nome').textContent = data['evento-nome'];
    
    // Desabilitar botão e mostrar estado de carregamento
    const submitBtn = document.getElementById('btn-salvar-info');
    const originalText = submitBtn ? submitBtn.textContent : null;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Salvando...'; }
    
    try {
        // Salvar no Firestore incluindo ownerUid para controle de propriedade
        await setDoc(doc(db, "eventos", AppState.eventoId), {
            infoGerais: data,
            ownerUid: auth.currentUser ? auth.currentUser.uid : null,
            ultimaAtualizacao: serverTimestamp()
        }, { merge: true });

        showNotification('Informações salvas com sucesso!');

        // Atualizar estado local
        AppState.setEvento(AppState.eventoId, { infoGerais: data });

        // Iniciar listeners em tempo real para as subcoleções
    // Iniciar listeners em tempo real
    iniciarListenersTempoReal();
    // Marcar seção de cronograma como ativa para o usuário ver o resultado
    try { document.querySelector('nav a[href="#cronograma"]').click(); } catch (e) {}
        
    } catch (error) {
        console.error("Erro ao salvar informações: ", error);
        showNotification('Erro ao salvar informações: ' + error.message, true);
    } finally {
        // Restaurar botão
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText || 'Salvar Informações'; }
    }
}

// Navegação por abas: mostrar/ocultar seções e marcar link ativo
function setupTabs() {
    const links = document.querySelectorAll('nav a');
    if (!links || links.length === 0) return;
    links.forEach(a => {
        a.addEventListener('click', (ev) => {
            ev.preventDefault();
            const href = a.getAttribute('href');
            if (!href || !href.startsWith('#')) return;
            // esconder todas as seções
            document.querySelectorAll('main .section').forEach(s => s.classList.add('hidden'));
            const target = document.querySelector(href);
            if (target) target.classList.remove('hidden');
            // atualizar estado ativo no nav
            document.querySelectorAll('nav a').forEach(n => n.classList.remove('active'));
            a.classList.add('active');
            // rolar até topo da seção
            try { target.scrollIntoView({ behavior: 'smooth' }); } catch (e) {}
        });
    });
}

// Função para adicionar item ao cronograma
async function adicionarItemCronograma() {
    if (!AppState.eventoId) {
        showNotification('Primeiro salve as informações gerais do evento', true);
        return;
    }
    if (!requireAuth()) return;
    
    const novoItem = {
        horario: '',
        acao: 'Nova Atividade',
        tipo: 'outro',
    observacoes: '',
    timestamp: serverTimestamp(),
    ownerUid: auth.currentUser ? auth.currentUser.uid : null
    };
    
    try {
        // tentar garantir que o ownerUid do evento esteja disponível e alinhado com o usuário atual
        try { await waitForEventOwnerMatch(5000); } catch(e) {}
        // Diagnostic logs to help E2E debug permission issues
        try {
            console.log('DEBUG adicionarItemCronograma: auth.currentUser.uid=', auth && auth.currentUser ? auth.currentUser.uid : null, 'AppState.eventoData.ownerUid=', AppState.eventoData ? AppState.eventoData.ownerUid : null, 'AppState.eventoId=', AppState.eventoId);
        } catch (e) {}
    const ref = await addDoc(collection(db, "eventos", AppState.eventoId, "cronograma"), novoItem);
    try { window.__pendingSave = { type: 'cronograma', id: ref.id }; document.dispatchEvent(new CustomEvent('save:attempt', { detail: { type: 'cronograma', id: ref.id } })); } catch (e) {}
    } catch (error) {
        console.error("Erro ao adicionar item: ", error);
        showNotification('Erro ao adicionar item: ' + error.message, true);
    }
}

// Helper: aguarda até que o document eventos/{eventoId}.ownerUid === auth.currentUser.uid
// retorna true se alinhou dentro do timeout, false caso contrário
async function waitForEventOwnerMatch(timeoutMs = 3000, intervalMs = 250) {
    if (!AppState.eventoId) return false;
    const uid = auth && auth.currentUser ? auth.currentUser.uid : null;
    if (!uid) return false;
    const ref = doc(db, 'eventos', AppState.eventoId);
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const snap = await getDoc(ref);
            if (snap && snap.exists()) {
                const data = snap.data();
                if (data && data.ownerUid && data.ownerUid === uid) return true;
            }
        } catch (e) {
            // ignorar e tentar novamente
        }
        await new Promise(r => setTimeout(r, intervalMs));
    }
    return false;
}

// Função para atualizar item do cronograma
async function atualizarItemCronograma(itemId, campo, valor) {
    try {
        await updateDoc(doc(db, "eventos", AppState.eventoId, "cronograma", itemId), {
            [campo]: valor,
            ultimaModificacao: serverTimestamp()
        });
    } catch (error) {
        console.error("Erro ao atualizar item: ", error);
        showNotification('Erro ao atualizar item: ' + error.message, true);
    }
}

// Função para remover item do cronograma
async function removerItemCronograma(itemId) {
    if (!confirm('Tem certeza que deseja remover este item?')) return;
    
    try {
    await deleteDoc(doc(db, "eventos", AppState.eventoId, "cronograma", itemId));
    } catch (error) {
        console.error("Erro ao remover item: ", error);
        showNotification('Erro ao remover item: ' + error.message, true);
    }
}

// Função para renderizar a tabela de cronograma
function renderizarCronograma(items) {
    const tbody = document.querySelector('#tabela-cronograma tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    items.forEach(item => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-id', item.id);
        
        tr.innerHTML = `
            <td>
                <input type="time" value="${item.horario}" 
                    data-action="atualizar-cronograma" data-field="horario">
            </td>
            <td>
                <input type="text" value="${item.acao}" 
                    data-action="atualizar-cronograma" data-field="acao">
            </td>
            <td>
                <select data-action="atualizar-cronograma" data-field="tipo">
                    <option value="banda" ${item.tipo === 'banda' ? 'selected' : ''}>Banda</option>
                    <option value="ativacao" ${item.tipo === 'ativacao' ? 'selected' : ''}>Ativação</option>
                    <option value="efeito" ${item.tipo === 'efeito' ? 'selected' : ''}>Efeito Especial</option>
                    <option value="outro" ${item.tipo === 'outro' ? 'selected' : ''}>Outro</option>
                </select>
            </td>
            <td>
                <textarea data-action="atualizar-cronograma" data-field="observacoes">${item.observacoes || ''}</textarea>
            </td>
            <td>
                <button class="btn-secondary btn-danger" data-action="remover-cronograma">Remover</button>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}

// Função para salvar/atualizar vídeo
async function salvarVideo(e) {
    e.preventDefault();
    console.log('salvarVideo: handler invoked');
    if (!requireAuth()) return;

    console.log('salvarVideo: after requireAuth AppState.eventoId=', AppState.eventoId, 'user=', AppState.user);
    if (!AppState.eventoId && typeof window !== 'undefined' && window.AppState && window.AppState.eventoId) {
        AppState.eventoId = window.AppState.eventoId;
        console.log('salvarVideo: reconciled AppState.eventoId from window.AppState=', AppState.eventoId);
    }
    if (!AppState.eventoId) {
        showNotification('Primeiro salve as informações gerais do evento', true);
        return;
    }

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    const videoId = data['video-id'];

    // Remover o campo video-id dos dados
    delete data['video-id'];
    data.timestamp = serverTimestamp();

    // Validação leve
    const validVideo = validateVideo(data);
    if (!validVideo.ok) { showNotification(validVideo.msg, true); return; }

    // Desabilitar botão e mostrar estado de carregamento
    const submitBtn = document.getElementById('btn-salvar-video');
    const originalText = submitBtn ? submitBtn.textContent : 'Salvar';
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Salvando...'; }

    try {
        console.log('salvarVideo: attempting to save', { videoId, data });
        if (videoId) {
            // Atualizar vídeo existente
            try {
                const evDoc = await getDoc(doc(db, 'eventos', AppState.eventoId));
                console.log('DEBUG salvarVideo: currentUid=', auth.currentUser ? auth.currentUser.uid : null, 'event.ownerUid=', evDoc && evDoc.exists() ? evDoc.data().ownerUid : null);
            } catch (e) { console.warn('DEBUG salvarVideo: failed to read event doc', e); }
            // aguardar alinhamento ownerUid (timeout maior) e log detalhado antes da tentativa
            try { await waitForEventOwnerMatch(7000); } catch (e) {}
            // Pre-write diagnostics
            try {
                const evRef = doc(db, 'eventos', AppState.eventoId);
                const evSnap = await getDoc(evRef);
                console.log('PREWRITE salvarVideo (update): event.exists=', evSnap && evSnap.exists(), 'event.data=', evSnap && evSnap.exists() ? evSnap.data() : null);
                console.log('PREWRITE salvarVideo payload=', { ...data, ultimaModificacao: '<serverTimestamp>' });
            } catch (e) { console.warn('PREWRITE salvarVideo: failed to read event doc', e); }

            // Tentativa com retry em caso de falhas intermitentes (ex: PERMISSION_DENIED por propagação)
            let saveAttempts = 0;
            const saveMaxAttempts = 3;
            while (true) {
                try {
                    await updateDoc(doc(db, "eventos", AppState.eventoId, "videos", videoId), {
                        ...data,
                        ultimaModificacao: serverTimestamp()
                    });
                    showNotification('Vídeo atualizado com sucesso!');
                    // marcar pending save para confirmação via onSnapshot
                    try { window.__pendingSave = { type: 'video', id: videoId }; document.dispatchEvent(new CustomEvent('save:attempt', { detail: { type: 'video', id: videoId } })); } catch (e) {}
                    break;
                } catch (err) {
                    saveAttempts++;
                    console.error('salvarVideo: update attempt failed', saveAttempts, err && err.code, err && err.message);
                    if (saveAttempts >= saveMaxAttempts) throw err;
                    // brief backoff and re-check owner visibility
                    await new Promise(r => setTimeout(r, 500));
                    try { await waitForEventOwnerMatch(3000); } catch (e) {}
                }
            }
        } else {
            // Adicionar novo vídeo
            try {
                const evDoc = await getDoc(doc(db, 'eventos', AppState.eventoId));
                console.log('DEBUG salvarVideo (add): currentUid=', auth.currentUser ? auth.currentUser.uid : null, 'event.ownerUid=', evDoc && evDoc.exists() ? evDoc.data().ownerUid : null);
            } catch (e) { console.warn('DEBUG salvarVideo: failed to read event doc', e); }
            try { await waitForEventOwnerMatch(7000); } catch(e) {}
            // Pre-write diagnostics
            try {
                const evRef = doc(db, 'eventos', AppState.eventoId);
                const evSnap = await getDoc(evRef);
                console.log('PREWRITE salvarVideo (add): event.exists=', evSnap && evSnap.exists(), 'event.data=', evSnap && evSnap.exists() ? evSnap.data() : null);
                console.log('PREWRITE salvarVideo payload=', { ...data, ownerUid: auth.currentUser ? auth.currentUser.uid : null });
            } catch (e) { console.warn('PREWRITE salvarVideo (add): failed to read event doc', e); }

            // Retry loop for add
            let addAttempts = 0;
            const addMaxAttempts = 3;
            let ref = null;
            while (true) {
                try {
                    ref = await addDoc(collection(db, "eventos", AppState.eventoId, "videos"), {
                        ...data,
                        ownerUid: auth.currentUser ? auth.currentUser.uid : null
                    });
                    showNotification('Vídeo adicionado com sucesso!');
                    try { window.__pendingSave = { type: 'video', id: ref.id }; document.dispatchEvent(new CustomEvent('save:attempt', { detail: { type: 'video', id: ref.id } })); } catch (e) {}
                    break;
                } catch (err) {
                    addAttempts++;
                    console.error('salvarVideo: add attempt failed', addAttempts, err && err.code, err && err.message);
                    if (addAttempts >= addMaxAttempts) throw err;
                    await new Promise(r => setTimeout(r, 500));
                    try { await waitForEventOwnerMatch(3000); } catch (e) {}
                }
            }
        }

        console.log('salvarVideo: finished saving (form reset)');

        // Limpar formulário
        form.reset();

    } catch (error) {
        console.error("Erro ao salvar vídeo: ", error, 'message=', error && error.message, 'code=', error && error.code);
        showNotification('Erro ao salvar vídeo: ' + (error && error.message ? error.message : String(error)), true);
    } finally {
        // Restaurar botão
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
    }
}

// --- Equipe: CRUD básico (subcollection 'equipe') ---
async function salvarMembroEquipe(e) {
    e.preventDefault();
    console.log('salvarMembroEquipe: handler invoked');
    if (!requireAuth()) return;
    console.log('salvarMembroEquipe: after requireAuth AppState.eventoId=', AppState.eventoId, 'user=', AppState.user);
    if (!AppState.eventoId && typeof window !== 'undefined' && window.AppState && window.AppState.eventoId) {
        AppState.eventoId = window.AppState.eventoId;
        console.log('salvarMembroEquipe: reconciled AppState.eventoId from window.AppState=', AppState.eventoId);
    }
    if (!AppState.eventoId) { showNotification('Primeiro salve as informações gerais do evento', true); return; }

    const form = e.target;
    const data = Object.fromEntries(new FormData(form));
    const id = data['membro-id'];
    delete data['membro-id'];
    data.timestamp = serverTimestamp();
    data.ownerUid = auth.currentUser ? auth.currentUser.uid : null;

    console.log('salvarMembroEquipe: submitting', {id, data});

    try {
        if (id) {
            try {
                const evDoc = await getDoc(doc(db, 'eventos', AppState.eventoId));
                console.log('DEBUG salvarMembroEquipe: currentUid=', auth.currentUser ? auth.currentUser.uid : null, 'event.ownerUid=', evDoc && evDoc.exists() ? evDoc.data().ownerUid : null);
            } catch (e) { console.warn('DEBUG salvarMembroEquipe: failed to read event doc', e); }
            try { await waitForEventOwnerMatch(3000); } catch(e) {}
            await updateDoc(doc(db, 'eventos', AppState.eventoId, 'equipe', id), { ...data, ultimaModificacao: serverTimestamp() });
            showNotification('Membro atualizado');
            try { window.__pendingSave = { type: 'equipe', id }; document.dispatchEvent(new CustomEvent('save:attempt', { detail: { type: 'equipe', id } })); } catch (e) {}
        } else {
            try {
                const evDoc = await getDoc(doc(db, 'eventos', AppState.eventoId));
                console.log('DEBUG salvarMembroEquipe (add): currentUid=', auth.currentUser ? auth.currentUser.uid : null, 'event.ownerUid=', evDoc && evDoc.exists() ? evDoc.data().ownerUid : null);
            } catch (e) { console.warn('DEBUG salvarMembroEquipe: failed to read event doc', e); }
            try { await waitForEventOwnerMatch(3000); } catch(e) {}
            const ref = await addDoc(collection(db, 'eventos', AppState.eventoId, 'equipe'), data);
            showNotification('Membro adicionado');
            try { window.__pendingSave = { type: 'equipe', id: ref.id }; document.dispatchEvent(new CustomEvent('save:attempt', { detail: { type: 'equipe', id: ref.id } })); } catch (e) {}
        }
        form.reset();
        console.log('salvarMembroEquipe: finished');
    } catch (err) {
        console.error('Erro salvar membro:', err, 'message=', err && err.message, 'code=', err && err.code);
        showNotification('Erro ao salvar membro: ' + (err && err.message ? err.message : String(err)), true);
    }
}

async function removerMembroEquipe(id) {
    if (!confirm('Remover membro?')) return;
    if (!requireAuth()) return;
    try { await deleteDoc(doc(db, 'eventos', AppState.eventoId, 'equipe', id)); } catch (err) { console.error(err); showNotification('Erro ao remover membro', true); }
}

function renderizarEquipe(items) {
    const container = document.getElementById('lista-equipe');
    if (!container) return;
    console.log('renderizarEquipe: items count=', items ? items.length : 0);
    container.innerHTML = '';
    if (!items || items.length === 0) { container.innerHTML = '<p class="no-videos">Nenhum membro.</p>'; return; }
    items.forEach(m => {
        const card = document.createElement('div');
        card.className = 'video-card';
        card.setAttribute('data-id', m.id);
        card.innerHTML = `
            <h4>${m['membro-nome'] || 'Sem nome'}</h4>
            <p><strong>Função:</strong> ${m['membro-funcao'] || '-'}</p>
            <div class="video-actions">
                <button data-action="editar-membro" data-id="${m.id}" class="btn-secondary">Editar</button>
                <button data-action="remover-membro" data-id="${m.id}" class="btn-secondary btn-danger">Remover</button>
            </div>`;
        container.appendChild(card);
    });
}

// --- Entregas: CRUD básico (subcollection 'entregas') ---
async function salvarEntrega(e) {
    e.preventDefault();
    console.log('salvarEntrega: handler invoked');
    if (!requireAuth()) return;
    console.log('salvarEntrega: after requireAuth AppState.eventoId=', AppState.eventoId, 'user=', AppState.user);
    if (!AppState.eventoId && typeof window !== 'undefined' && window.AppState && window.AppState.eventoId) {
        AppState.eventoId = window.AppState.eventoId;
        console.log('salvarEntrega: reconciled AppState.eventoId from window.AppState=', AppState.eventoId);
    }
    if (!AppState.eventoId) { showNotification('Primeiro salve as informações gerais do evento', true); return; }

    const form = e.target;
    const data = Object.fromEntries(new FormData(form));
    const id = data['entrega-id'];
    delete data['entrega-id'];
    data.timestamp = serverTimestamp();
    data.ownerUid = auth.currentUser ? auth.currentUser.uid : null;
    console.log('salvarEntrega: submitting', { id, data });
    try {
        if (id) {
            try {
                const evDoc = await getDoc(doc(db, 'eventos', AppState.eventoId));
                console.log('DEBUG salvarEntrega: currentUid=', auth.currentUser ? auth.currentUser.uid : null, 'event.ownerUid=', evDoc && evDoc.exists() ? evDoc.data().ownerUid : null);
            } catch (e) { console.warn('DEBUG salvarEntrega: failed to read event doc', e); }
            try { await waitForEventOwnerMatch(7000); } catch(e) {}
            try {
                const evRef = doc(db, 'eventos', AppState.eventoId);
                const evSnap = await getDoc(evRef);
                console.log('PREWRITE salvarEntrega (update): event.exists=', evSnap && evSnap.exists(), 'event.data=', evSnap && evSnap.exists() ? evSnap.data() : null);
                console.log('PREWRITE salvarEntrega payload=', { ...data, ultimaModificacao: '<serverTimestamp>' });
            } catch (e) { console.warn('PREWRITE salvarEntrega: failed to read event doc', e); }

            let saveAttempts = 0;
            const saveMaxAttempts = 3;
            while (true) {
                try {
                    await updateDoc(doc(db, 'eventos', AppState.eventoId, 'entregas', id), { ...data, ultimaModificacao: serverTimestamp() });
                    showNotification('Entrega atualizada');
                    try { window.__pendingSave = { type: 'entrega', id }; document.dispatchEvent(new CustomEvent('save:attempt', { detail: { type: 'entrega', id } })); } catch (e) {}
                    break;
                } catch (err) {
                    saveAttempts++;
                    console.error('salvarEntrega: update attempt failed', saveAttempts, err && err.code, err && err.message);
                    if (saveAttempts >= saveMaxAttempts) throw err;
                    await new Promise(r => setTimeout(r, 500));
                    try { await waitForEventOwnerMatch(3000); } catch (e) {}
                }
            }
        } else {
            try {
                const evDoc = await getDoc(doc(db, 'eventos', AppState.eventoId));
                console.log('DEBUG salvarEntrega (add): currentUid=', auth.currentUser ? auth.currentUser.uid : null, 'event.ownerUid=', evDoc && evDoc.exists() ? evDoc.data().ownerUid : null);
            } catch (e) { console.warn('DEBUG salvarEntrega: failed to read event doc', e); }
            try { await waitForEventOwnerMatch(7000); } catch(e) {}
            try {
                const evRef = doc(db, 'eventos', AppState.eventoId);
                const evSnap = await getDoc(evRef);
                console.log('PREWRITE salvarEntrega (add): event.exists=', evSnap && evSnap.exists(), 'event.data=', evSnap && evSnap.exists() ? evSnap.data() : null);
                console.log('PREWRITE salvarEntrega payload=', data);
            } catch (e) { console.warn('PREWRITE salvarEntrega (add): failed to read event doc', e); }

            let addAttempts = 0;
            const addMaxAttempts = 3;
            let ref = null;
            while (true) {
                try {
                    ref = await addDoc(collection(db, 'eventos', AppState.eventoId, 'entregas'), data);
                    showNotification('Entrega adicionada');
                    try { window.__pendingSave = { type: 'entrega', id: ref.id }; document.dispatchEvent(new CustomEvent('save:attempt', { detail: { type: 'entrega', id: ref.id } })); } catch (e) {}
                    break;
                } catch (err) {
                    addAttempts++;
                    console.error('salvarEntrega: add attempt failed', addAttempts, err && err.code, err && err.message);
                    if (addAttempts >= addMaxAttempts) throw err;
                    await new Promise(r => setTimeout(r, 500));
                    try { await waitForEventOwnerMatch(3000); } catch (e) {}
                }
            }
        }
        form.reset();
        console.log('salvarEntrega: finished');
    } catch (err) { console.error('Erro salvar entrega:', err, 'message=', err && err.message, 'code=', err && err.code); showNotification('Erro ao salvar entrega: ' + (err && err.message ? err.message : String(err)), true); }
}

async function removerEntrega(id) {
    if (!confirm('Remover entrega?')) return;
    if (!requireAuth()) return;
    try { await deleteDoc(doc(db, 'eventos', AppState.eventoId, 'entregas', id)); } catch (err) { console.error(err); showNotification('Erro ao remover entrega', true); }
}

function renderizarEntregas(items) {
    const container = document.getElementById('lista-entregas');
    if (!container) return;
    console.log('renderizarEntregas: items count=', items ? items.length : 0);
    container.innerHTML = '';
    if (!items || items.length === 0) { container.innerHTML = '<p class="no-videos">Nenhuma entrega.</p>'; return; }
    items.forEach(it => {
        const card = document.createElement('div');
        card.className = 'video-card';
        card.setAttribute('data-id', it.id);
        card.innerHTML = `
            <h4>${it['entrega-titulo'] || 'Sem título'}</h4>
            <p><strong>Prazo:</strong> ${it['entrega-prazo'] || '-'}</p>
            <p><strong>Status:</strong> ${it['entrega-status'] || '-'}</p>
            <div class="video-actions">
                <button data-action="editar-entrega" data-id="${it.id}" class="btn-secondary">Editar</button>
                <button data-action="remover-entrega" data-id="${it.id}" class="btn-secondary btn-danger">Remover</button>
            </div>`;
        container.appendChild(card);
    });
}

// Preenche um formulário com dados de um objeto, opcionalmente usando um prefixo de nome
function fillForm(form, data, prefix = '') {
    if (!form || !data) return;
    Object.entries(data).forEach(([k, v]) => {
        const name = prefix ? `${prefix}-${k}` : k;
        const el = form.elements.namedItem(name) || form.elements.namedItem(k) || form.elements.namedItem(prefix ? `${prefix}${k}` : null);
        if (!el) return;
        try {
            if (el.tagName === 'SELECT' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.value = v || '';
        } catch (e) {}
    });
}

// Atualizar iniciarListenersTempoReal para incluir equipe e entregas

// Função para atualizar status do vídeo
async function atualizarStatusVideo(videoId, novoStatus) {
    try {
        await updateDoc(doc(db, "eventos", AppState.eventoId, "videos", videoId), {
            status: novoStatus,
            ultimaModificacao: serverTimestamp()
        });
    } catch (error) {
        console.error("Erro ao atualizar status: ", error);
        showNotification('Erro ao atualizar status: ' + error.message, true);
    }
}

// Função para remover vídeo
async function removerVideo(videoId) {
    if (!confirm('Tem certeza que deseja remover este vídeo?')) return;
    if (!requireAuth()) return;

    try {
        await deleteDoc(doc(db, "eventos", AppState.eventoId, "videos", videoId));
    } catch (error) {
        console.error("Erro ao remover vídeo: ", error);
        showNotification('Erro ao remover vídeo: ' + error.message, true);
    }
}

// Função para renderizar a lista de vídeos
function renderizarVideos(videos, categoria = 'todos') {
    const container = document.getElementById('lista-videos');
    if (!container) return;
    console.log('renderizarVideos: videos count=', videos ? videos.length : 0, 'categoria=', categoria);
    container.innerHTML = '';
    
    // Filtrar por categoria se necessário
    const videosFiltrados = categoria === 'todos' 
        ? videos 
        : videos.filter(video => video.categoria === categoria);
    
    if (videosFiltrados.length === 0) {
        container.innerHTML = '<p class="no-videos">Nenhum vídeo encontrado.</p>';
        return;
    }
    
    videosFiltrados.forEach(video => {
        const card = document.createElement('div');
        card.className = 'video-card';
        card.setAttribute('data-id', video.id);

        // Mapear status para classes CSS
        const statusClass = `status-${video.status || 'pendente'}`;
        const statusText = {
            'pendente': 'Pendente',
            'edicao': 'Em Edição',
            'aprovacao': 'Para Aprovação',
            'revisao': 'Em Revisão',
            'aprovado': 'Aprovado'
        }[video.status] || 'Pendente';

        card.innerHTML = `
            <h4>${video.descricao || 'Sem descrição'}</h4>
            <div class="video-status ${statusClass}">${statusText}</div>
            <p><strong>Categoria:</strong> ${video.categoria || '-'}</p>
            <p><strong>Tipo:</strong> ${video.tipo || '-'}</p>
            <p><strong>Horário:</strong> ${video.horario || '-'}</p>
            <p><strong>Duração:</strong> ${video.duracao || '-'}</p>
            <p><strong>Formato:</strong> ${video.formato || '-'}</p>
            
            <div class="video-actions">
                <button class="btn-secondary" data-action="editar-video">Editar</button>
                <button class="btn-secondary btn-danger" data-action="remover-video">Remover</button>
                <select data-action="mudar-status" aria-label="Mudar status">
                    <option value="pendente" ${video.status === 'pendente' ? 'selected' : ''}>Pendente</option>
                    <option value="edicao" ${video.status === 'edicao' ? 'selected' : ''}>Em Edição</option>
                    <option value="aprovacao" ${video.status === 'aprovacao' ? 'selected' : ''}>Para Aprovação</option>
                    <option value="revisao" ${video.status === 'revisao' ? 'selected' : ''}>Em Revisão</option>
                    <option value="aprovado" ${video.status === 'aprovado' ? 'selected' : ''}>Aprovado</option>
                </select>
            </div>
        `;

        container.appendChild(card);
    });
}

// Função para popular formulário de edição de vídeo
function popularFormularioEdicaoVideo(video) {
    const form = document.getElementById('form-video');
    if (!form) return;
    // mapear video fields para form names: video-categoria => categoria
    const mapped = {};
    Object.entries(video).forEach(([k, v]) => {
        if (k === 'id') return;
        // remove prefix if already prefixed
        mapped[k] = v;
        mapped[`video-${k}`] = v;
    });
    if (form.elements.namedItem('video-id')) form.elements.namedItem('video-id').value = video.id || '';
    // preencher usando helper
    fillForm(form, mapped);
    try { document.querySelector('nav a[href="#videos"]').click(); } catch (e) {}
    try { form.scrollIntoView({ behavior: 'smooth' }); } catch (e) {}
}

// Função para iniciar listeners em tempo real
async function iniciarListenersTempoReal() {
    // Parar listeners anteriores se existirem
    if (AppState.unsubscribeCronograma) try { AppState.unsubscribeCronograma(); } catch (e) {}
    if (AppState.unsubscribeVideos) try { AppState.unsubscribeVideos(); } catch (e) {}

    if (!AppState.eventoId) return;

    // Garantir que temos os dados do evento (incluindo ownerUid) antes de anexar listeners
    try {
        const evRef = doc(db, 'eventos', AppState.eventoId);
        const evSnap = await getDoc(evRef);
        if (evSnap && evSnap.exists()) {
            const data = evSnap.data();
            AppState.eventoData = data || null;
            try { updateUIWithEventData(data); } catch (e) {}
        }
    } catch (e) {
        console.warn('Erro ao buscar documento do evento antes de iniciar listeners', e);
    }

    // Listener para o cronograma (ordenado por timestamp)
    AppState.unsubscribeCronograma = onSnapshot(
        fsQuery(collection(db, "eventos", AppState.eventoId, "cronograma"), orderBy('timestamp')),
        (snapshot) => {
            const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            // Ordenação segura (caso timestamp seja um objeto Firestore)
            items.sort((a, b) => {
                const ta = a.timestamp && a.timestamp.toMillis ? a.timestamp.toMillis() : (a.timestamp || 0);
                const tb = b.timestamp && b.timestamp.toMillis ? b.timestamp.toMillis() : (b.timestamp || 0);
                return ta - tb;
            });
            AppState.setCronograma(items);
            renderizarCronograma(items);
            // confirmar pending save para cronograma
            try {
                if (window.__pendingSave && window.__pendingSave.type === 'cronograma') {
                    const found = items.find(i => i.id === window.__pendingSave.id);
                    if (found) {
                        try { document.dispatchEvent(new CustomEvent('save:success', { detail: { type: 'cronograma', id: found.id } })); } catch (e) {}
                        window.__pendingSave = null;
                    }
                }
            } catch (e) { console.warn('Erro ao confirmar save pendente cronograma', e); }
        },
        (error) => {
            console.error("Erro ao receber atualizações do cronograma: ", error);
            showNotification('Erro ao sincronizar cronograma', true);
        }
    );

    // Listener para os vídeos (ordenado por timestamp)
    AppState.unsubscribeVideos = onSnapshot(
        fsQuery(collection(db, "eventos", AppState.eventoId, "videos"), orderBy('timestamp')),
        (snapshot) => {
            const videos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            videos.sort((a, b) => {
                const ta = a.timestamp && a.timestamp.toMillis ? a.timestamp.toMillis() : (a.timestamp || 0);
                const tb = b.timestamp && b.timestamp.toMillis ? b.timestamp.toMillis() : (b.timestamp || 0);
                return ta - tb;
            });
            AppState.setVideos(videos);
            const categoriaAtivaEl = document.querySelector('.category-btn.active');
            const categoriaAtiva = categoriaAtivaEl ? categoriaAtivaEl.dataset.category : 'todos';
            renderizarVideos(videos, categoriaAtiva);
            // Se houver um save pendente, verificar se o snapshot já contém o doc
            try {
                if (window.__pendingSave && window.__pendingSave.type === 'video') {
                    const found = videos.find(v => v.id === window.__pendingSave.id);
                    if (found) {
                        try { document.dispatchEvent(new CustomEvent('save:success', { detail: { type: 'video', id: found.id } })); } catch (e) {}
                        window.__pendingSave = null;
                    }
                }
            } catch (e) { console.warn('Erro ao confirmar save pendente video', e); }
        },
        (error) => {
            console.error("Erro ao receber atualizações de vídeos: ", error);
            showNotification('Erro ao sincronizar vídeos', true);
        }
    );

    // Listener para equipe
    if (AppState.unsubscribeEquipe) try { AppState.unsubscribeEquipe(); } catch (e) {}
    AppState.unsubscribeEquipe = onSnapshot(
        fsQuery(collection(db, 'eventos', AppState.eventoId, 'equipe'), orderBy('timestamp')),
        (snapshot) => {
            const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            renderizarEquipe(items);
            try {
                if (window.__pendingSave && window.__pendingSave.type === 'equipe') {
                    const found = items.find(i => i.id === window.__pendingSave.id);
                    if (found) {
                        try { document.dispatchEvent(new CustomEvent('save:success', { detail: { type: 'equipe', id: found.id } })); } catch (e) {}
                        window.__pendingSave = null;
                    }
                }
            } catch (e) { console.warn('Erro ao confirmar save pendente equipe', e); }
        },
        (err) => { console.error('Erro sync equipe', err); }
    );

    // Listener para entregas
    if (AppState.unsubscribeEntregas) try { AppState.unsubscribeEntregas(); } catch (e) {}
    AppState.unsubscribeEntregas = onSnapshot(
        fsQuery(collection(db, 'eventos', AppState.eventoId, 'entregas'), orderBy('timestamp')),
        (snapshot) => {
            const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            renderizarEntregas(items);
            try {
                if (window.__pendingSave && window.__pendingSave.type === 'entrega') {
                    const found = items.find(i => i.id === window.__pendingSave.id);
                    if (found) {
                        try { document.dispatchEvent(new CustomEvent('save:success', { detail: { type: 'entrega', id: found.id } })); } catch (e) {}
                        window.__pendingSave = null;
                    }
                }
            } catch (e) { console.warn('Erro ao confirmar save pendente entrega', e); }
        },
        (err) => { console.error('Erro sync entregas', err); }
    );

    // Emitir um sinal que os listeners em tempo real estão prontos - útil para E2E
    try {
        if (typeof window !== 'undefined') {
            window.__listenersReady = true;
        }
        document.dispatchEvent(new Event('listeners-ready'));
    } catch (e) {}
}

// Expor hooks úteis para testes (após definições de auth/listeners)
try {
    if (typeof window !== 'undefined') {
        try { window.auth = auth; } catch (e) {}
        try { window.getAuth = () => auth; } catch (e) {}
        try { window.signInWithEmailAndPassword = signInWithEmailAndPassword; } catch (e) {}
        try { window.createUserWithEmailAndPassword = createUserWithEmailAndPassword; } catch (e) {}
        try { window.signOut = signOut; } catch (e) {}
        try { window.serverTimestamp = serverTimestamp; } catch (e) {}
        try { window.firebaseDb = db; } catch (e) {}
        try { window.iniciarListenersTempoReal = iniciarListenersTempoReal; } catch (e) {}
        try {
            // helper para testes: criar evento a partir do contexto do cliente (garante ownerUid == auth.currentUser.uid)
            window.createEventClient = async function(eventId) {
                try {
                    if (!eventId) return false;
                    const owner = auth && auth.currentUser ? auth.currentUser.uid : null;
                    if (!owner) return false;
                    await setDoc(doc(db, 'eventos', eventId), {
                        ownerUid: owner,
                        infoGerais: { 'evento-nome': 'E2E Test Event' },
                        ultimaAtualizacao: serverTimestamp()
                    }, { merge: true });
                    return true;
                } catch (e) { console.warn('createEventClient failed', e); return false; }
            };
        } catch (e) {}
        try { window.AppState = AppState; } catch (e) {}
    }
} catch (e) {}

// Função para carregar dados existentes ao iniciar
async function carregarDadosExistentes() {
    const urlParams = new URLSearchParams(window.location.search);
    const eventParam = urlParams.get('evento');

    if (!eventParam) return;

    const sanitized = sanitizeEventId(eventParam);
    try {
        const docRef = doc(db, 'eventos', sanitized);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            AppState.setEvento(sanitized, data);
            updateUIWithEventData(data);
            iniciarListenersTempoReal();
        } else {
            // Criar documento mínimo quando não existir
            await setDoc(docRef, { infoGerais: { 'evento-nome': eventParam }, ultimaAtualizacao: serverTimestamp() });
            const newSnap = await getDoc(docRef);
            AppState.setEvento(sanitized, newSnap.data());
            updateUIWithEventData(newSnap.data());
            iniciarListenersTempoReal();
        }
    } catch (error) {
        console.error('Erro ao carregar dados: ', error);
        showNotification('Erro ao carregar dados do evento', true);
    }
}

// Configuração de event delegation
function configurarEventDelegation() {
    // Delegation para a tabela de cronograma
    const tbody = document.querySelector('#tabela-cronograma tbody');
    if (tbody) {
        tbody.addEventListener('change', (e) => {
            const target = e.target;
            const action = target.getAttribute('data-action');
            const tr = target.closest('tr');
            const itemId = tr && tr.getAttribute('data-id');
            if (action === 'atualizar-cronograma' && itemId) {
                const field = target.getAttribute('data-field');
                const value = target.value;
                atualizarItemCronograma(itemId, field, value);
            }
        });

        tbody.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            const tr = btn.closest('tr');
            const itemId = tr && tr.getAttribute('data-id');
            if (action === 'remover-cronograma' && itemId) removerItemCronograma(itemId);
        });
    }

    // Delegation para a lista de vídeos
    const lista = document.getElementById('lista-videos');
    if (lista) {
        lista.addEventListener('change', (e) => {
            const target = e.target;
            const action = target.getAttribute('data-action') || (target.getAttribute('aria-label') === 'Mudar status' && 'mudar-status');
            const card = target.closest('.video-card');
            const videoId = card && card.getAttribute('data-id');
            if (action === 'mudar-status' && videoId) atualizarStatusVideo(videoId, target.value);
            if (action === 'atualizar-feedback-video' && videoId) {
                const feedback = target.value;
                updateDoc(doc(db, 'eventos', AppState.eventoId, 'videos', videoId), { feedback, ultimaModificacao: serverTimestamp() }).catch(err => console.error(err));
            }
        });

        lista.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            const card = btn.closest('.video-card');
            const videoId = card && card.getAttribute('data-id');
            if (action === 'remover-video' && videoId) removerVideo(videoId);
            if (action === 'editar-video' && videoId) {
                const video = AppState.videos.find(v => v.id === videoId);
                if (video) popularFormularioEdicaoVideo(video);
            }
        });
    }

    // Delegation para lista de equipe
    const listaEquipe = document.getElementById('lista-equipe');
    if (listaEquipe) {
        listaEquipe.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            const card = btn.closest('.video-card');
            const id = card && card.getAttribute('data-id');
            if (action === 'remover-membro' && id) removerMembroEquipe(id);
            if (action === 'editar-membro' && id) {
                const form = document.getElementById('form-equipe');
                getDoc(doc(db, 'eventos', AppState.eventoId, 'equipe', id)).then(snap => {
                    if (!snap.exists()) return;
                    const data = snap.data();
                    if (form) {
                        if (form.elements.namedItem('membro-id')) form.elements.namedItem('membro-id').value = id;
                        // usar helper para preencher restante
                        fillForm(form, data);
                        try { document.querySelector('nav a[href="#equipe"]').click(); } catch (e) {}
                        form.scrollIntoView({ behavior: 'smooth' });
                    }
                }).catch(err => console.error(err));
            }
        });
    }

    // Delegation para lista de entregas
    const listaEntregas = document.getElementById('lista-entregas');
    if (listaEntregas) {
        listaEntregas.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            const card = btn.closest('.video-card');
            const id = card && card.getAttribute('data-id');
            if (action === 'remover-entrega' && id) removerEntrega(id);
            if (action === 'editar-entrega' && id) {
                const form = document.getElementById('form-entrega');
                getDoc(doc(db, 'eventos', AppState.eventoId, 'entregas', id)).then(snap => {
                    if (!snap.exists()) return;
                    const data = snap.data();
                    if (form) {
                        if (form.elements.namedItem('entrega-id')) form.elements.namedItem('entrega-id').value = id;
                        fillForm(form, data);
                        try { document.querySelector('nav a[href="#entregas"]').click(); } catch (e) {}
                        form.scrollIntoView({ behavior: 'smooth' });
                    }
                }).catch(err => console.error(err));
            }
        });
    }

    // Filtros de categoria de vídeos
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const categoria = btn.dataset.category || 'todos';
            renderizarVideos(AppState.videos, categoria);
        });
    });
}

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', function() {
    console.log('app: DOMContentLoaded - initializing app listeners');
    // Inicializa autenticação (tenta signin anônimo)
    initAuth();

    // Ajusta texto inicial do indicador de autenticação
    const authElInit = document.getElementById('auth-status');
    if (authElInit) authElInit.textContent = '(autenticação: verificando...)';
    const reauthBtn = document.getElementById('btn-reauth');
    if (reauthBtn) reauthBtn.addEventListener('click', (e) => { e.preventDefault(); reauth(); });
    // Vincular botões de autenticação por email
    const signinBtn = document.getElementById('btn-signin');
    const signupBtn = document.getElementById('btn-signup');
    const signoutBtn = document.getElementById('btn-signout');
    const emailInput = document.getElementById('auth-email');
    const passInput = document.getElementById('auth-password');

    if (signinBtn) signinBtn.addEventListener('click', (ev) => { ev.preventDefault(); signinWithEmail(emailInput.value, passInput.value); });
    if (signupBtn) signupBtn.addEventListener('click', (ev) => { ev.preventDefault(); signupWithEmail(emailInput.value, passInput.value); });
    if (signoutBtn) signoutBtn.addEventListener('click', (ev) => { ev.preventDefault(); signoutCurrent(); });
    // Configurar event listeners
    const formInfo = document.getElementById('form-info-gerais');
    if (formInfo) formInfo.addEventListener('submit', salvarInformacoesGerais);
    console.log('app: listener attached to form-info-gerais?', !!formInfo);
    const addCron = document.getElementById('add-cronograma');
    if (addCron) addCron.addEventListener('click', adicionarItemCronograma);
    console.log('app: listener attached to add-cronograma?', !!addCron);
    const formVideoEl = document.getElementById('form-video');
    if (formVideoEl) formVideoEl.addEventListener('submit', salvarVideo);
    console.log('app: listener attached to form-video?', !!formVideoEl);
    const formEquipe = document.getElementById('form-equipe');
    if (formEquipe) formEquipe.addEventListener('submit', salvarMembroEquipe);
    console.log('app: listener attached to form-equipe?', !!formEquipe);
    const formEntrega = document.getElementById('form-entrega');
    if (formEntrega) formEntrega.addEventListener('submit', salvarEntrega);
    console.log('app: listener attached to form-entrega?', !!formEntrega);
    
    // Configurar event delegation
    configurarEventDelegation();
    // Configurar navegação por abas (se existente)
    try { setupTabs(); } catch (e) {}
    
    // Carregar dados existentes se houver um evento na URL
    carregarDadosExistentes();

    // Mostrar/ocultar campo de feedback baseado no status (no formulário de vídeo)
    const statusSelect = document.querySelector('select[name="video-status"]');
    if (statusSelect) {
        statusSelect.addEventListener('change', function() {
            const feedbackGroup = document.getElementById('feedback-cliente-group');
            if (this.value === 'aprovacao' || this.value === 'revisao') {
                feedbackGroup.classList.remove('hidden');
            } else {
                feedbackGroup.classList.add('hidden');
            }
        });
    }

    // Subscrição para atualizar UI quando o estado mudar
    AppState.subscribe((state) => {
        if (state.eventoData) updateUIWithEventData(state.eventoData);
    });
});

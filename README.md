# Sistema de Gestão de Produção de Eventos — Gonetwork

Aplicação web simples para gerenciar informações gerais, cronograma e vídeos de um evento.

## Status atual das melhorias

- Autenticação (email/senha + anônimo) integrada no frontend
- Regras do Firestore publicadas (restrição por `ownerUid`)
- Listeners em tempo real com cleanup
- Validações leves no front-end e mensagens de erro

## Arquivos principais

# Sistema de Gestão de Produção de Eventos — Gonetwork

Descrição
---------
Aplicação web simples para gerenciar informações gerais, cronograma e vídeos de um evento.

Status das melhorias aplicadas
--------------------------------
- Autenticação integrada (Email/Senha e anônimo)
- Regras do Firestore publicadas (gravação restrita a `ownerUid`)
- Listeners em tempo real com cleanup correto
- Validações básicas no frontend e mensagens amigáveis

Arquivos principais
-------------------
- `index.html` — página principal e carregamento dos módulos
- `styles/style.css` — regras de estilo
- `scripts/script.js` — lógica principal (Firestore, UI, Auth, validações)
- `scripts/smoke-test.js` — script de validação via REST (cria usuário temporário)
- `firebase-config.js` — arquivo de configuração do Firebase (NÃO comitar)

Pré-requisitos
-------------
- Node.js 14+ (para rodar o smoke-test)
- Conta e projeto no Firebase

Configurar o Firebase
---------------------
1. No Console do Firebase, crie/abra o projeto.
2. Habilite Firestore (modo bloqueado) e Authentication → Email/Password.
3. Preencha `firebase-config.js` com o objeto `firebaseConfig` do seu projeto. Exemplo: não comitar esse arquivo.

Rodando localmente
------------------
1. Instale dependências locais:

```powershell
npm install
```

2. Sirva a pasta do projeto com o servidor estático:

```powershell
npm run serve
```

3. Abra no navegador (exemplo):

```
http://127.0.0.1:5500/index.html?evento=Meu%20Evento
```

Smoke-test (opcional, para validar regras e auth)
-----------------------------------------------
O projeto fornece `scripts/smoke-test.js` que:
- cria um usuário temporário via Identity Toolkit REST
- autentica e obtém idToken
- tenta criar um documento em Firestore via REST para validar as regras

Execute:

```powershell
node scripts/smoke-test.js
```

Segurança e boas práticas
-------------------------
- Não comite `firebase-config.js` com credenciais públicas.
- As regras do Firestore exigem que documentos criados/atualizados incluam `ownerUid == request.auth.uid`.
- Para produção, refine `firestore.rules` para validar tipos e tamanhos de campos.

Próximos passos recomendados
---------------------------
1. Harden das regras do Firestore (tipos, limites, validações por campo).
2. Adicionar testes unitários e integração (CI).
3. Vincular contas anônimas a contas permanentes se quiser preservar dados ao converter usuários.

Licença
-------
Adaptar conforme necessidade.

Contato
-------
Gonetwork — equipe de desenvolvimento

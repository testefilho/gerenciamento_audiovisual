# evento-producao

Aplicação web simples para gerenciar informações gerais, cronograma e vídeos de um evento.

[![Emulator tests](https://github.com/drrdanilosa/evento-producao/actions/workflows/ci.yml/badge.svg)](https://github.com/drrdanilosa/evento-producao/actions/workflows/ci.yml)

## Status das melhorias aplicadas

- Autenticação integrada (Email/Senha e anônimo)
- Regras do Firestore publicadas (gravação restrita a ownerUid)
- Listeners em tempo real com cleanup correto
- Validações básicas no frontend e mensagens amigáveis

## Arquivos principais

- `index.html` — página principal e carregamento dos módulos
- `styles/style.css` — regras de estilo
- `scripts/script.js` — lógica principal (Firestore, UI, Auth, validações)
- `scripts/smoke-test.js` — script de validação via REST (cria usuário temporário)
- `firestore.rules` — regras de segurança (ver `firestore.rules`)
- `firebase-config.js` — arquivo de configuração do Firebase (NÃO comitar)

> Nota: se `firebase-config.js` foi acidentalmente comitado, remova-o do histórico e do repositório antes de compartilhar este projeto publicamente. Os arquivos de log `firebase-debug.log` e `firestore-debug.log` também são locais e não devem ser versionados. Adicione `firebase-config.js` e arquivos de log ao seu `.gitignore`.

## Pré-requisitos

- Node.js (recomendado >= 20 para CI e compatibilidade com dependências)
- Conta e projeto no Firebase

## Configurar o Firebase

1. No Console do Firebase, crie/abra o projeto.
2. Habilite Firestore (modo bloqueado) e Authentication → Email/Password.
3. Copie `firebase-config.js.template` para `firebase-config.js` e preencha o objeto `firebaseConfig` com as credenciais do seu projeto. NÃO comite `firebase-config.js`.

## Como rodar localmente (visualizar a aplicação)

1. Instale dependências:

```powershell
npm ci
```

2. Copie o template e preencha suas credenciais do Firebase:

```powershell
cp firebase-config.js.template firebase-config.js
# edite firebase-config.js e cole seu objeto firebaseConfig
```

3. Inicie o servidor estático (a aplicação ficará disponível em `http://127.0.0.1:5500`):

```powershell
npm run serve
```

Se quiser usar os emuladores locais (opcional), rode:

```powershell
npx firebase init emulators   # aceita criar configuração local, se necessário
npx firebase emulators:start --only firestore,auth
```

## Running emulator-based tests (local)

The repository includes emulator-based tests which run the Firebase emulators and execute small REST validations and the Puppeteer E2E.

Run the REST validation (quick check):

```powershell
npx firebase emulators:exec "node tests/rest-validate.js"
```

Run the full headless E2E (uses your local Chrome if you set PUPPETEER_EXECUTABLE_PATH):

```powershell
setx PUPPETEER_EXECUTABLE_PATH "C:\Program Files\Google\Chrome\Application\new_chrome.exe"
npx firebase emulators:exec "npm run e2e-headless"
```

CI: a GitHub Actions workflow é `.github/workflows/ci.yml` e executa ambos os checks em push/PR.

Obs: para a aplicação conectar automaticamente aos emuladores quando estiverem rodando, abra:

`http://127.0.0.1:5500?useEmulator=true`



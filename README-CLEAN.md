# Sistema de Gestão de Produção de Eventos — Gonetwork

Aplicação web para gerenciar informações gerais, cronograma e vídeos de eventos.

## Melhorias aplicadas

- Autenticação (Email/Password + anônimo) integrada no frontend
- Regras do Firestore publicadas (controle por `ownerUid`)
- Listeners em tempo real com cleanup
- Validações leves no front-end e mensagens de erro

## Estrutura do projeto

- `index.html` — interface e inicialização do Firebase
- `styles/style.css` — estilos
- `scripts/script.js` — lógica principal (Firestore, UI, auth)
- `scripts/smoke-test.js` — script de smoke test (REST API)
- `firebase-config.js` — configuração do Firebase (não commitar)

## Executando localmente

1. Preencha `firebase-config.js` com as credenciais do projeto.

2. No Console do Firebase, habilite **Authentication → Email/Password** e **Firestore**.

3. Instale dependências e rode o servidor localmente:

```powershell
npm install
npm run serve
```

4. Abra no navegador (exemplo):

```http
http://127.0.0.1:5500/index.html?evento=Meu%20Evento
```

## Smoke-test (automatizado)

O repositório inclui `scripts/smoke-test.js` que cria um usuário temporário, autentica e testa gravações via REST.

Execute:

```powershell
node scripts/smoke-test.js
```

ou via npm:

```powershell
npm run smoke-test
```

> Observação: o smoke-test usa a `apiKey` em `firebase-config.js` e criará contas temporárias no seu projeto Firebase.

## Observações de segurança

- As regras do Firestore foram publicadas e exigem `ownerUid` nas operações de escrita.
- Não comite suas credenciais (`firebase-config.js`) em repositórios públicos.

## Próximos passos recomendados

- Revisar `firestore.rules` para validações por campo e limites (produção).
- Adicionar testes automatizados e pipeline CI.

---

Licença: adaptar conforme necessidade

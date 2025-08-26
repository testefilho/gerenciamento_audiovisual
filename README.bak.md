````markdown
# Sistema de Gestão de Produção de Eventos — Gonetwork

Aplicação web simples para gerenciar informações gerais, cronograma e vídeos de um evento.

## Status atual das melhorias

- Autenticação (email/senha + anônimo) integrada no frontend
- Regras do Firestore publicadas (restrição por `ownerUid`)
- Listeners em tempo real com cleanup
- Validações leves no front-end e mensagens de erro

## Arquivos principais

- `index.html` — interface e inicialização do Firebase
- `styles/style.css` — estilos
- `scripts/script.js` — lógica principal (Firestore, UI, auth)
- `scripts/smoke-test.js` — script de smoke test (REST API)
- `firebase-config.js` — configuração do Firebase (não commitar)

## Como rodar localmente

1. Preencha `firebase-config.js` com as credenciais do projeto.
2. No Console do Firebase, habilite **Authentication → Email/Password** e **Firestore**.
3. Instale dependências e sirva localmente:

```powershell
npm install
npm run serve
```

4. Abra no navegador:

```http
http://127.0.0.1:5500/index.html?evento=Meu%20Evento
```

## Rodando o smoke-test automatizado

O projeto inclui `scripts/smoke-test.js` que cria um usuário temporário, autentica e testa gravações via REST.

Para executar:

```powershell
node scripts/smoke-test.js
```

> Observação: o script usa a `apiKey` em `firebase-config.js` e irá criar contas temporárias no seu projeto Firebase.

## Observações

- As regras do Firestore foram implantadas e exigem `ownerUid` nas operações de escrita.
- Mantenha o arquivo `firebase-config.js` privado (não commite chaves sensíveis em repositórios públicos).

## Próximos passos recomendados

- Revisar `firestore.rules` para requisitos de produção (validação de campos, limites, censura de tamanho).
- Adicionar testes automatizados e pipeline CI.

---

Licença: adaptar conforme necessidade
````

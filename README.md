# Sistema de Gestão de Produção de Eventos — Gonetwork

[![Emulator tests](https://github.com/drrdanilosa/evento-producao/actions/workflows/emulator-tests.yml/badge.svg)](https://github.com/drrdanilosa/evento-producao/actions/workflows/emulator-tests.yml)

Aplicação web simples para gerenciar informações gerais, cronograma e vídeos de um evento.

## Status das melhorias aplicadas

- Autenticação integrada (Email/Senha e anônimo)
- Regras do Firestore publicadas (gravação restrita a ownerUid)
- Listeners em tempo real com cleanup correto
- Validações básicas no frontend e mensagens amigáveis

## Arquivos principais

- index.html — página principal e carregamento dos módulos
- styles/style.css — regras de estilo
- scripts/script.js — lógica principal (Firestore, UI, Auth, validações)
- scripts/smoke-test.js — script de validação via REST (cria usuário temporário)
- irestore.rules — regras de segurança (ver irestore.rules)
- irebase-config.js — arquivo de configuração do Firebase (NÃO comitar)

## Pré-requisitos

- Node.js (recomendado >= 20 para CI e compatibilidade com dependências)
- Conta e projeto no Firebase

## Configurar o Firebase

1. No Console do Firebase, crie/abra o projeto.
2. Habilite Firestore (modo bloqueado) e Authentication → Email/Password.
3. Preencha irebase-config.js com o objeto irebaseConfig do seu projeto. Não comite esse arquivo.

## Como rodar os testes do emulador

1. Instale dependências: 
pm ci
2. Rode os testes do emulador: 
pm run test:emulator (isso iniciará o Firestore Emulator e executará os testes configudados).


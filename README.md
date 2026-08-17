# DAKAR MOTOS — Atualização Supabase + Realtime

## 1. Configurar o banco
1. Entre no Supabase e abra o projeto.
2. SQL Editor → New query.
3. Abra `banco.sql`, copie tudo e cole.
4. Clique em RUN.

O SQL cria as tabelas, permissões, Realtime e a rotina de reset diário.

## 2. Pegar URL e chave
Supabase → Project Settings → API.
Pegue:
- Project URL
- Publishable key

Não use service_role key no navegador.

## 3. Configurar app.js
Abra `app.js` e altere:
const SUPABASE_URL="COLE_AQUI_SUA_PROJECT_URL";
const SUPABASE_KEY="COLE_AQUI_SUA_PUBLISHABLE_KEY";

## 4. GitHub
Envie para a raiz do repositório:
index.html
style.css
app.js
logo-dakar.jpg
banco.sql
README.md

## 5. Recursos
- Sincronização em tempo real entre PCs/TV.
- Seleção manual da próxima troca.
- Marcar mecânico como disponível/ocupado.
- Sequência automática pula ocupados quando possível.
- Histórico compartilhado.
- Reset diário às 18:00 no horário de Brasília (a rotina SQL agenda 21:00 UTC).
- A TV usa ?painel=1.

Observação: o reset usa pg_cron se a extensão estiver disponível no projeto Supabase. Se a extensão não estiver disponível, o restante do sistema funciona normalmente, mas o reset automático precisará ser configurado pelo agendador disponível no projeto.


## ATUALIZAÇÃO V2 — prioridade por quantidade
Execute `atualizacao.sql` uma vez no SQL Editor do Supabase.

A nova regra é: menor número de trocas entre os disponíveis tem prioridade; empate segue Gil → Amauri → Samuel → Tiaguinho → Tiago. O clique no nome da Ordem de Serviço coloca o mecânico diretamente no painel. O botão OCUPADO abre o corretor para retirar 1 troca de qualquer mecânico.

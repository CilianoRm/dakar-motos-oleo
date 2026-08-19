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


## Módulo Funcionários — V5

A versão 5 adiciona um menu embutido com **Funcionários**, protegido pela senha `Marcos8904`.

### Banco de dados

O banco de óleo existente não precisa ser recriado. Para ativar o módulo Funcionários, execute **uma única vez** o arquivo `employee_schema.sql` no SQL Editor do Supabase. Ele cria as tabelas `funcionarios` e `pontos_funcionarios`, insere os seis funcionários e habilita Realtime/RLS.

### Controle de ponto

Cada funcionário pode registrar, em sequência, chegada, saída para almoço, retorno e saída. Para quem não tem almoço cadastrado, o sistema usa chegada e saída. O sistema calcula horas trabalhadas, horas esperadas, saldo do dia e saldo acumulado do mês.

### Alteração de horários

Dentro de Funcionários, use **ALTERAR HORÁRIOS**. As mudanças são salvas no Supabase e valem para os próximos registros; pontos antigos não são recalculados.

> Observação de segurança: a senha do módulo é uma trava de interface no navegador, não um mecanismo de segurança empresarial. Para dados trabalhistas sensíveis, o ideal é futuramente migrar o acesso para autenticação do Supabase.

# DAKAR MOTOS — Controle de Troca de Óleo

Versão corrigida preservando o projeto original.

## Novidades
- Clique diretamente no nome do mecânico na Ordem de Serviço para colocar a vez no painel.
- Removidos os controles de “Escolher próxima troca” e “Voltar para sequência automática”.
- Prioridade automática: mecânico disponível com menor quantidade de trocas.
- Empates respeitam a ordem Gil → Amauri → Samuel → Tiaguinho → Tiago.
- Mecânicos ocupados ficam fora da prioridade.
- TROCOU ÓLEO soma +1 e recalcula a próxima prioridade.
- OCUPADO abre o corretor para escolher um mecânico e retirar -1 troca.
- Histórico registra as correções.
- Supabase e painel da TV continuam no mesmo formato.

## Publicação
Substitua os arquivos do seu repositório pelos arquivos desta pasta. Não é necessário executar novo SQL para essas alterações; o schema existente já possui os campos usados.

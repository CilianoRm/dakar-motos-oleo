V13.2

- Remove o resumo de folgas/férias da agenda.
- DIAS JÁ DEVIDOS mostra somente o saldo acumulado/manual de dias devidos (incluindo faltas já lançadas), sem ser reduzido por créditos ou alterado pelo saldo mensal.
- SALDO DISPONÍVEL continua usando a lógica de créditos e débitos para comparação.
- Não requer SQL novo.


## V14 — horários por dia
Execute `employee_schedule_v14.sql` uma única vez no Supabase. Ele cria os campos de segunda a domingo e migra automaticamente a configuração antiga. A partir da V14, a tela ALTERAR HORÁRIOS permite definir entrada, saída e almoço separadamente para cada dia. O calendário mostra automaticamente NÃO TRABALHA nos dias sem horário.

FÉRIAS marcadas na agenda reduzem os dias disponíveis. NÃO VEIO acrescenta automaticamente 1 dia em DIAS JÁ DEVE / FALTAS ANTERIORES, sem alterar o saldo disponível diretamente.

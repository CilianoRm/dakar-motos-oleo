# Dakar Motos — Funcionários / Ponto / Agenda — V16

Novidades desta versão:
- Cadastro do tipo de jornada: PERÍODO INTEGRAL (44h/semana) ou MEIO PERÍODO (22h/semana).
- O tipo de jornada fica dentro de ALTERAR HORÁRIOS.
- CARGA HORÁRIA MÊS fica junto de CARGA ESPERADA e é calculada pela soma dos horários programados no mês.
- CARGA HORÁRIA EXCEDENTE MÊS é assinada: horas trabalhadas fechadas no mês até hoje menos o padrão da jornada selecionada até hoje. Positivo = acima; negativo = abaixo.

Para uma base existente, execute uma única vez `employee_jornada_v16.sql` no SQL Editor do Supabase.


## V17 — Almoço independente por dia
- Cada dia da semana possui almoço próprio e independente.
- É possível colocar almoço em apenas um dia, mudar o horário em outro dia ou deixar sem almoço.
- Ao apagar o almoço de um dia, ele permanece apagado e não é preenchido automaticamente pelo almoço de outro dia.
- O lançamento de ponto usa o almoço configurado especificamente para a data escolhida.
- Não há SQL novo nesta versão: a correção é no `app.js` e no cache da página.

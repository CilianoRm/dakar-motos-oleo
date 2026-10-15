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

## V18 — Importação do ponto eletrônico Knup KP-1028
- Na aba Funcionários, use **IMPORTAR PONTO** e selecione o arquivo `.xls` ou `.xlsx` exportado pelo relógio.
- O importador lê as abas `1,2,3` e `4,5,6`, identifica datas, nomes e os quatro horários: entrada, saída para almoço, retorno e saída.
- Apresenta uma prévia antes de gravar os registros.
- Campos vazios no relatório não apagam os horários já existentes; registros são atualizados por funcionário/data, sem criar duplicatas.
- Funcionários que não forem reconhecidos são sinalizados na prévia. Cadastre-os na tela **GERENCIAR** antes de importar.
- Não exige SQL novo. A leitura de Excel usa a biblioteca SheetJS incluída por CDN.
- Faça upload do ZIP completo para o GitHub Pages. Se a página antiga ficar em cache, faça recarga forçada (Ctrl+F5).

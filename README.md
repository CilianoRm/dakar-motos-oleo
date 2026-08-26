# Dakar Motos — V13

## Novidades
- **Gerenciar funcionários** dentro da aba Funcionários.
- Adicionar funcionário informando **somente o nome**.
- Remover funcionário sem apagar históricos, pontos ou agendas.
- Se um funcionário removido for adicionado novamente pelo mesmo nome, o cadastro anterior é reativado.
- Para o caso do **Rubens**, basta entrar em **GERENCIAR** e clicar em **REMOVER**.
- **Saldo do mês corrigido:** o dia atual não entra no saldo enquanto estiver em andamento. Ele só passa a contar depois que a **SAÍDA** for lançada.
- Dias anteriores sem saída registrada também não entram como saldo parcial.
- O saldo do mês continua sendo exibido somente como valor positivo/negativo, por exemplo `+01:30` ou `-02:15`.

## Supabase
Não é necessário executar SQL novo nesta versão, desde que a tabela `funcionarios` e suas políticas de INSERT/UPDATE da versão anterior já estejam configuradas.

## Publicação
Substitua os arquivos do site no GitHub e faça `Ctrl+F5`.
A versão usa `app.js?v=13.0` e `style.css?v=13.0` para evitar cache da versão anterior.

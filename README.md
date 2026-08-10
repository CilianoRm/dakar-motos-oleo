# Dakar Motos — Controle de Troca de Óleo (Web)

## Como usar

1. Publique estes arquivos no GitHub Pages.
2. Abra o site no computador da loja.
3. Use a tela principal como **CONTROLE**.
4. Clique em **ABRIR PAINEL DA TV** para abrir uma segunda aba.
5. Na segunda aba, o endereço termina com `?painel=1`.
6. Transmita essa segunda aba pelo Google Chrome para a TV.

### Sincronização

O sistema usa `localStorage` + `BroadcastChannel`, portanto o controle e o painel funcionam sincronizados quando estão em abas do mesmo navegador/computador.

Não precisa de banco de dados, servidor ou internet para sincronizar as duas abas depois que o site estiver carregado.

### Importante

Se você abrir o painel em outro computador/celular independente, ele não compartilhará os dados com o computador de controle. Para isso seria necessário adicionar um banco online (por exemplo, Supabase/Firebase).

## GitHub Pages

No GitHub:
- crie um repositório;
- envie `index.html`, `style.css`, `app.js` e `logo-dakar.jpg`;
- vá em Settings → Pages;
- selecione Deploy from a branch;
- escolha `main` e `/root`;
- salve.

A URL ficará semelhante a:
`https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`

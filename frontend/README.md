# Frontend — Favorita

Interface web responsiva para consumir a API de Clientes e Favoritos publicada na Cloudflare Workers.

## Executar localmente

1. Abra esta pasta no VS Code.
2. Inicie um servidor estático (recomendado: extensão Live Server).
3. Abra o endereço local fornecido pelo Live Server.

Também é possível usar:

```bash
npx serve .
```

## API utilizada

`https://api-clientes-favoritos.kauamsantos100.workers.dev`

O endereço fica definido no início de `app.js`, na constante `API`.

## Funcionalidades

- Cadastro de cliente com nome, e-mail e senha.
- Catálogo com imagens, preços e busca.
- Filtro por categoria.
- Detalhes do produto.
- Adicionar e remover favoritos.
- Edição e exclusão do cadastro.
- Mensagens de carregamento, sucesso e erro.
- Layout adaptável a celular e desktop.

## Observação sobre acesso

A API atual não possui endpoint de login/autenticação. Após cadastrar, a interface guarda o ID do cliente no `localStorage` do navegador. Para acessar um cadastro existente, use a opção **Já tenho ID** e informe o ID correspondente. Isso não substitui autenticação segura e não deve ser usado como controle de acesso em produção.

## Publicar no Cloudflare Pages

1. Envie a pasta `frontend` para o mesmo repositório.
2. No painel Cloudflare, abra **Workers & Pages** e crie um projeto Pages conectado ao GitHub.
3. Selecione o repositório.
4. Configure:
   - Framework preset: `None`
   - Build command: deixe vazio
   - Build output directory: `frontend`
5. Clique em **Save and Deploy**.
6. Use a URL `*.pages.dev` gerada na entrega.

A API já utiliza middleware CORS do Hono (`app.use("*", cors())`), permitindo requisições do navegador. Para produção, recomenda-se restringir a origem CORS ao domínio definitivo do Pages.

## Estrutura

```text
frontend/
├── index.html
├── style.css
├── app.js
└── README.md
```

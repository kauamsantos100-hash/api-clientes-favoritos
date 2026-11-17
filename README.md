# API de Clientes e Favoritos

API REST desenvolvida em JavaScript com Hono e Cloudflare Workers, utilizando Cloudflare D1 para armazenamento de dados e a Fake Store API para consulta de produtos.

O projeto permite cadastrar e gerenciar clientes, consultar produtos e criar listas de produtos favoritos para cada cliente.

## Tecnologias utilizadas

- **JavaScript** — linguagem principal.
- **Hono** — framework para criação das rotas da API.
- **Cloudflare Workers** — hospedagem e execução da API.
- **Cloudflare D1** — banco de dados SQL.
- **Fake Store API** — fonte externa de produtos e categorias.
- **Git e GitHub** — versionamento e armazenamento do código.
- **GitHub Actions** — automação do processo de publicação.

## URL da API

A API está publicada e pode ser acessada pelo endereço:

https://api-clientes-favoritos.kauamsantos100.workers.dev

## Funcionalidades

- Cadastro de clientes.
- Consulta de clientes.
- Atualização de dados de clientes.
- Exclusão de clientes.
- Consulta de produtos.
- Consulta de produtos por ID.
- Consulta de categorias.
- Adição de produtos aos favoritos.
- Listagem dos favoritos de cada cliente.
- Remoção de produtos favoritos.
- Validação de e-mails duplicados.
- Validação de produtos existentes.
- Prevenção de produtos duplicados na lista de favoritos.
- Armazenamento de senhas utilizando hash.

## Endpoints

Todas as requisições devem utilizar a URL base:

```text
https://api-clientes-favoritos.kauamsantos100.workers.dev
```

### Clientes

| Método | Rota | Descrição |
|---|---|---|
| GET | `/clients` | Lista todos os clientes |
| GET | `/clients/:id` | Consulta um cliente |
| POST | `/clients` | Cadastra um cliente |
| PUT | `/clients/:id` | Atualiza um cliente |
| DELETE | `/clients/:id` | Exclui um cliente |

### Produtos

| Método | Rota | Descrição |
|---|---|---|
| GET | `/products` | Lista os produtos |
| GET | `/products/:id` | Consulta um produto pelo ID |
| GET | `/categories` | Lista as categorias |

### Favoritos

| Método | Rota | Descrição |
|---|---|---|
| GET | `/clients/: 
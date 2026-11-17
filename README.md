# API de Cadastro de Clientes e Gerenciamento de Produtos Favoritos

API REST em **JavaScript (ES Modules) + [Hono](https://hono.dev)**, publicada no **Cloudflare Workers**, com persistência no **Cloudflare D1** e consumo da **[Fake Store API](https://fakestoreapi.com)**.

## Arquitetura

```
Cliente HTTP  <->  Cloudflare Worker (Hono)  <->  Cloudflare D1 (clients, favorites)
                                             <->  Fake Store API (produtos)
```

## Pré-requisitos

- Node.js 18+
- Conta gratuita na [Cloudflare](https://dash.cloudflare.com/sign-up)

## Como rodar

```bash
npm install
npx wrangler login

# 1. Criar o banco e copiar o database_id para o wrangler.toml
npx wrangler d1 create clientes-favoritos-db

# 2. Criar as tabelas
npm run db:local     # desenvolvimento local
npm run db:remote    # produção

# 3. Rodar localmente
npm run dev          # http://localhost:8787

# 4. Publicar
npm run deploy       # https://api-clientes-favoritos.<sua-conta>.workers.dev
```

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| POST | `/clients` | Cadastra cliente (`{ "name", "email" }`) |
| GET | `/clients/:id` | Consulta cliente |
| GET | `/products?category=` | Lista produtos da Fake Store API |
| GET | `/products/:id` | Detalha um produto |
| GET | `/clients/:id/favorites` | Lista favoritos do cliente |
| POST | `/clients/:id/favorites` | Adiciona favorito (`{ "productId": 1 }`) |
| DELETE | `/clients/:id/favorites/:productId` | Remove favorito |

## Exemplos

```bash
BASE=http://localhost:8787

curl -X POST $BASE/clients -H "Content-Type: application/json" \
  -d '{"name":"Maria Silva","email":"maria@email.com"}'

curl $BASE/products

curl -X POST $BASE/clients/1/favorites -H "Content-Type: application/json" \
  -d '{"productId":3}'

curl $BASE/clients/1/favorites

curl -X DELETE $BASE/clients/1/favorites/3
```

## Decisões

- **E-mail único** por cliente (409 em duplicidade).
- Ao favoritar, o produto é **validado na Fake Store API** (404 se não existir) e um snapshot (título, preço, categoria, imagem) é salvo no D1, assim a listagem de favoritos não depende da API externa.
- `UNIQUE (client_id, product_id)` impede favoritos duplicados (409).
- `ON DELETE CASCADE` remove os favoritos se o cliente for removido.

## Deploy automático (opcional)

O workflow `.github/workflows/deploy.yml` publica no Workers a cada push na `main`.
Cadastre em **Settings → Secrets and variables → Actions** os secrets `CLOUDFLARE_API_TOKEN`
(template "Edit Cloudflare Workers") e `CLOUDFLARE_ACCOUNT_ID`.

## Licença

MIT

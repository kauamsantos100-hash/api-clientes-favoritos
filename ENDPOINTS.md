# Documentação dos Endpoints — API de Clientes e Favoritos

## 1. Visão geral

API REST desenvolvida em JavaScript com Hono, executada na Cloudflare Workers, utilizando Cloudflare D1 para armazenar clientes e produtos favoritos. Os dados do catálogo de produtos e categorias são consultados na Fake Store API.

**URL base de produção:**

```text
https://api-clientes-favoritos.kauamsantos100.workers.dev
```

Todas as rotas retornam JSON, exceto quando indicado. Para requisições com corpo, envie `Content-Type: application/json`.

## 2. Resumo das rotas

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/` | Exibe informações da API e lista de endpoints |
| POST | `/clients` | Cadastra um cliente |
| GET | `/clients` | Lista os clientes |
| GET | `/clients/:id` | Consulta um cliente pelo ID |
| PUT | `/clients/:id` | Atualiza os dados de um cliente |
| DELETE | `/clients/:id` | Exclui um cliente e seus favoritos |
| GET | `/products` | Lista os produtos |
| GET | `/products?category=:category` | Lista produtos de uma categoria |
| GET | `/products/:id` | Consulta um produto pelo ID |
| GET | `/categories` | Lista as categorias |
| GET | `/clients/:id/favorites` | Lista os favoritos de um cliente |
| POST | `/clients/:id/favorites` | Adiciona um produto aos favoritos |
| DELETE | `/clients/:id/favorites/:productId` | Remove um produto dos favoritos |

---

## 3. Endpoint raiz

### `GET /`

Retorna o nome da API e a lista de endpoints disponíveis.

**Exemplo:**

```http
GET https://api-clientes-favoritos.kauamsantos100.workers.dev/
```

**Resposta — `200 OK`:**

```json
{
  "name": "API de Cadastro de Clientes e Produtos Favoritos",
  "endpoints": [
    "POST /clients",
    "GET /clients",
    "GET /clients/:id",
    "PUT /clients/:id",
    "DELETE /clients/:id",
    "GET /products",
    "GET /products/:id",
    "GET /categories",
    "GET /clients/:id/favorites",
    "POST /clients/:id/favorites",
    "DELETE /clients/:id/favorites/:productId"
  ]
}
```

## 4. Clientes

### 4.1 Cadastrar cliente

**`POST /clients`**

Cadastra um cliente. O e-mail é convertido para letras minúsculas e a senha é armazenada como hash PBKDF2 com SHA-256.

**Corpo da requisição:**

```json
{
  "name": "Maria Silva",
  "email": "maria@email.com",
  "password": "senha123"
}
```

**Campos:**

| Campo | Tipo | Obrigatório | Regra |
|---|---|---|---|
| `name` | string | Sim | Não pode estar vazio |
| `email` | string | Sim | Deve possuir formato válido |
| `password` | string | Sim | Mínimo de 8 caracteres |

**Resposta — `201 Created`:**

```json
{
  "id": 1,
  "name": "Maria Silva",
  "email": "maria@email.com",
  "created_at": "2026-11-18 12:00:00"
}
```

O valor de `created_at` é gerado pelo banco de dados.

**Possíveis erros:**

- `400 Bad Request` — dados inválidos ou senha com menos de 8 caracteres.
- `409 Conflict` — e-mail já cadastrado.

### 4.2 Listar clientes

**`GET /clients`**

Retorna todos os clientes, sem incluir o hash das senhas, ordenados pelo ID em ordem decrescente.

**Resposta — `200 OK`:**

```json
[
  {
    "id": 1,
    "name": "Maria Silva",
    "email": "maria@email.com",
    "created_at": "2026-11-18 12:00:00"
  }
]
```

### 4.3 Consultar cliente por ID

**`GET /clients/:id`**

Retorna os dados de um cliente específico.

**Exemplo:**

```http
GET /clients/1
```

**Resposta — `200 OK`:**

```json
{
  "id": 1,
  "name": "Maria Silva",
  "email": "maria@email.com",
  "created_at": "2026-11-18 12:00:00"
}
```

**Possíveis erros:**

- `400 Bad Request` — ID inválido.
- `404 Not Found` — cliente não encontrado.

### 4.4 Atualizar cliente

**`PUT /clients/:id`**

Atualiza nome e/ou e-mail. A senha também pode ser atualizada, se enviada. Os campos não enviados permanecem com os valores atuais.

**Exemplo de requisição:**

```http
PUT /clients/1
Content-Type: application/json
```

```json
{
  "name": "Maria Souza",
  "email": "maria.souza@email.com",
  "password": "novasenha123"
}
```

**Campos aceitos:**

| Campo | Tipo | Obrigatório | Regra |
|---|---|---|---|
| `name` | string | Não | Se enviado, não pode ficar vazio |
| `email` | string | Não | Se enviado, deve ser válido |
| `password` | string | Não | Se enviado, mínimo de 8 caracteres |

**Resposta — `200 OK`:**

Retorna o objeto do cliente atualizado, com `id`, `name`, `email` e `created_at`.

**Possíveis erros:**

- `400 Bad Request` — corpo JSON inválido, nome/e-mail inválido ou senha menor que 8 caracteres.
- `404 Not Found` — cliente não encontrado.
- `409 Conflict` — e-mail já cadastrado para outro cliente.

### 4.5 Excluir cliente

**`DELETE /clients/:id`**

Exclui o cliente e todos os favoritos associados a ele.

**Exemplo:**

```http
DELETE /clients/1
```

**Resposta — `200 OK`:**

```json
{
  "message": "Cliente e favoritos excluídos com sucesso."
}
```

**Possíveis erros:**

- `400 Bad Request` — ID inválido.
- `404 Not Found` — cliente não encontrado.

---

## 5. Produtos

Os endpoints de produtos consultam a Fake Store API. Os dados do catálogo não são cadastrados na tabela de clientes do D1.

### 5.1 Listar produtos

**`GET /products`**

Retorna a lista de produtos disponibilizada pela Fake Store API.

**Exemplo:**

```http
GET /products
```

**Resposta — `200 OK`:**

Retorna um array de produtos. Cada produto segue o formato fornecido pela Fake Store API, com campos como `id`, `title`, `price`, `description`, `category`, `image` e `rating`.

### 5.2 Filtrar produtos por categoria

**`GET /products?category=:category`**

Retorna os produtos pertencentes à categoria informada.

**Exemplo:**

```http
GET /products?category=electronics
```

O valor da categoria deve ser enviado como parâmetro de consulta (`category`).

### 5.3 Consultar produto por ID

**`GET /products/:id`**

Retorna os detalhes de um produto específico.

**Exemplo:**

```http
GET /products/1
```

**Resposta — `200 OK`:**

Retorna o objeto do produto fornecido pela Fake Store API.

**Possíveis erros:**

- `400 Bad Request` — ID inválido.
- `404 Not Found` — produto não encontrado.

### 5.4 Listar categorias

**`GET /categories`**

Retorna as categorias disponíveis na Fake Store API.

**Exemplo:**

```http
GET /categories
```

**Resposta — `200 OK`:**

```json
[
  "electronics",
  "jewelery",
  "men's clothing",
  "women's clothing"
]
```

A lista pode variar conforme os dados da API externa.

---

## 6. Favoritos

Os favoritos são associados a um cliente e armazenados no Cloudflare D1. Ao adicionar um favorito, a API consulta o produto na Fake Store API e salva os dados principais do produto.

### 6.1 Listar favoritos de um cliente

**`GET /clients/:id/favorites`**

Retorna os produtos favoritos do cliente informado, do mais recente para o mais antigo.

**Exemplo:**

```http
GET /clients/1/favorites
```

**Resposta — `200 OK`:**

```json
[
  {
    "productId": 1,
    "title": "Produto de exemplo",
    "price": 109.95,
    "category": "electronics",
    "image": "https://fakestoreapi.com/img/example.jpg",
    "created_at": "2026-11-18 12:00:00"
  }
]
```

**Possíveis erros:**

- `400 Bad Request` — ID inválido.
- `404 Not Found` — cliente não encontrado.

### 6.2 Adicionar produto aos favoritos

**`POST /clients/:id/favorites`**

Adiciona um produto à lista de favoritos do cliente. O produto precisa existir na Fake Store API.

**Corpo da requisição:**

```json
{
  "productId": 1
}
```

**Campo:**

| Campo | Tipo | Obrigatório | Regra |
|---|---|---|---|
| `productId` | number | Sim | Deve ser um número inteiro positivo e corresponder a um produto existente |

**Resposta — `201 Created`:**

Retorna o favorito salvo, com os campos `productId`, `title`, `price`, `category`, `image` e `created_at`.

**Possíveis erros:**

- `400 Bad Request` — ID do cliente ou `productId` inválido.
- `404 Not Found` — cliente não encontrado ou produto inexistente na Fake Store API.
- `409 Conflict` — produto já está nos favoritos.

### 6.3 Remover produto dos favoritos

**`DELETE /clients/:id/favorites/:productId`**

Remove um produto específico da lista de favoritos do cliente.

**Exemplo:**

```http
DELETE /clients/1/favorites/1
```

**Resposta — `204 No Content`:**

A remoção foi realizada com sucesso. Não há corpo na resposta.

**Possíveis erros:**

- `400 Bad Request` — ID do cliente ou do produto inválido.
- `404 Not Found` — favorito não encontrado.

---

## 7. Códigos HTTP utilizados

| Código | Significado | Quando ocorre |
|---|---|---|
| `200` | OK | Consulta, atualização ou exclusão concluída com resposta |
| `201` | Created | Cliente ou favorito criado |
| `204` | No Content | Favorito removido sem conteúdo de resposta |
| `400` | Bad Request | Dados enviados inválidos |
| `404` | Not Found | Rota, cliente, produto ou favorito não encontrado |
| `409` | Conflict | E-mail duplicado ou produto já favoritado |
| `502` | Bad Gateway | Erro interno tratado pela aplicação, inclusive falha ao consultar serviço externo |

As respostas de erro seguem o formato JSON, por exemplo:

```json
{
  "error": "Cliente não encontrado."
}
```

## 8. Observações importantes

- A API permite requisições de diferentes origens por meio do middleware CORS.
- As senhas não são retornadas nas consultas. No cadastro e na atualização, são armazenadas como hash PBKDF2 com SHA-256.
- A implementação atual não possui endpoint de login nem autenticação por token.
- As rotas que recebem o ID do cliente não exigem autenticação; portanto, o ID não deve ser tratado como prova de identidade ou autorização.
- Os produtos e categorias vêm da Fake Store API. Os favoritos são armazenados no Cloudflare D1.
- O parâmetro `productId` no corpo da requisição de inclusão de favorito usa exatamente essa grafia, respeitando letras maiúsculas e minúsculas.

## 9. Tecnologias

- JavaScript
- Hono
- Cloudflare Workers
- Cloudflare D1
- Fake Store API
- Git e GitHub

---
Documentação referente às rotas implementadas em `src/index.js` no repositório do projeto.

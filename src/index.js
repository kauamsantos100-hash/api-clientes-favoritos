
import { Hono } from "hono";
import { cors } from "hono/cors";

const FAKE_STORE = "https://fakestoreapi.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const app = new Hono();
app.use("*", cors());

// ---------- Helpers ----------

// Consulta a Fake Store API
async function fakeStore(path) {
  const res = await fetch(`${FAKE_STORE}${path}`, {
    headers: {
      "User-Agent": "api-clientes-favoritos/1.0",
      Accept: "application/json",
    },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Fake Store API respondeu ${res.status}`);
  }

  const text = await res.text();
  if (!text) return null;

  return JSON.parse(text);
}

// Validação de ID
function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Verifica se o cliente existe
async function clientExists(db, id) {
  return db.prepare(
    "SELECT id FROM clients WHERE id = ?"
  ).bind(id).first();
}

// Gera hash da senha
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    key,
    256
  );

  const saltBase64 = btoa(
    String.fromCharCode(...salt)
  );

  const hashBase64 = btoa(
    String.fromCharCode(...new Uint8Array(hash))
  );

  return `${saltBase64}:${hashBase64}`;
}

// ---------- Raiz ----------

app.get("/", (c) =>
  c.json({
    name: "API de Cadastro de Clientes e Produtos Favoritos",
    endpoints: [
      "POST /clients",
      "GET /clients/:id",
      "DELETE /clients/:id",
      "GET /products",
      "GET /products/:id",
      "GET /clients/:id/favorites",
      "POST /clients/:id/favorites",
      "DELETE /clients/:id/favorites/:productId",
    ],
  })
);

// ---------- Clientes ----------

// Cadastrar cliente
app.post("/clients", async (c) => {
  const body = await c.req.json().catch(() => null);

  const name =
    typeof body?.name === "string" ? body.name.trim() : "";

  const email =
    typeof body?.email === "string"
      ? body.email.trim().toLowerCase()
      : "";

  const password =
    typeof body?.password === "string" ? body.password : "";

  if (!name || !EMAIL_RE.test(email) || password.length < 8) {
    return c.json({
      error: "Informe nome, e-mail válido e senha com pelo menos 8 caracteres.",
    }, 400);
  }

  try {
    // Gera o hash antes de salvar
    const passwordHash = await hashPassword(password);

    const result = await c.env.DB.prepare(`
      INSERT INTO clients (name, email, password_hash)
      VALUES (?, ?, ?)
      RETURNING id, name, email, created_at
    `)
      .bind(name, email, passwordHash)
      .first();

    // Não retorna a senha nem o hash
    return c.json(result, 201);

  } catch (e) {
    if (String(e).includes("UNIQUE")) {
      return c.json({
        error: "E-mail já cadastrado.",
      }, 409);
    }

    throw e;
  }
});

// Consultar cliente por ID
app.get("/clients/:id", async (c) => {
  const id = parseId(c.req.param("id"));

  if (!id) {
    return c.json({ error: "ID inválido." }, 400);
  }

  const client = await c.env.DB.prepare(`
    SELECT id, name, email, created_at
    FROM clients
    WHERE id = ?
  `)
    .bind(id)
    .first();

  if (!client) {
    return c.json({
      error: "Cliente não encontrado.",
    }, 404);
  }

  return c.json(client);
});

// Excluir cliente e seus favoritos
app.delete("/clients/:id", async (c) => {
  const id = parseId(c.req.param("id"));

  if (!id) {
    return c.json({ error: "ID inválido." }, 400);
  }

  if (!(await clientExists(c.env.DB, id))) {
    return c.json({
      error: "Cliente não encontrado.",
    }, 404);
  }

  await c.env.DB.batch([
    c.env.DB.prepare(
      "DELETE FROM favorites WHERE client_id = ?"
    ).bind(id),

    c.env.DB.prepare(
      "DELETE FROM clients WHERE id = ?"
    ).bind(id),
  ]);

  return c.json({
    message: "Cliente e favoritos excluídos com sucesso.",
  });
});

// ---------- Produtos ----------

app.get("/products", async (c) => {
  const category = c.req.query("category");

  const path = category
    ? `/products/category/${encodeURIComponent(category)}`
    : "/products";

  const data = await fakeStore(path);

  return c.json(data ?? []);
});

app.get("/products/:id", async (c) => {
  const id = parseId(c.req.param("id"));

  if (!id) {
    return c.json({ error: "ID inválido." }, 400);
  }

  const product = await fakeStore(`/products/${id}`);

  if (!product) {
    return c.json({
      error: "Produto não encontrado.",
    }, 404);
  }

  return c.json(product);
});

// ---------- Favoritos ----------

// Listar favoritos
app.get("/clients/:id/favorites", async (c) => {
  const clientId = parseId(c.req.param("id"));

  if (!clientId) {
    return c.json({ error: "ID inválido." }, 400);
  }

  if (!(await clientExists(c.env.DB, clientId))) {
    return c.json({
      error: "Cliente não encontrado.",
    }, 404);
  }

  const { results } = await c.env.DB.prepare(`
    SELECT product_id AS productId, title, price,
           category, image, created_at
    FROM favorites
    WHERE client_id = ?
    ORDER BY created_at DESC, id DESC
  `)
    .bind(clientId)
    .all();

  return c.json(results);
});

// Adicionar favorito
app.post("/clients/:id/favorites", async (c) => {
  const clientId = parseId(c.req.param("id"));

  if (!clientId) {
    return c.json({ error: "ID inválido." }, 400);
  }

  if (!(await clientExists(c.env.DB, clientId))) {
    return c.json({
      error: "Cliente não encontrado.",
    }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const productId = Number(body?.productId);

  if (!Number.isInteger(productId) || productId <= 0) {
    return c.json({
      error: "Informe productId válido.",
    }, 400);
  }

  const product = await fakeStore(`/products/${productId}`);

  if (!product) {
    return c.json({
      error: "Produto não existe na Fake Store API.",
    }, 404);
  }

  try {
    const saved = await c.env.DB.prepare(`
      INSERT INTO favorites
        (client_id, product_id, title, price, category, image)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING product_id AS productId, title, price,
                category, image, created_at
    `)
      .bind(
        clientId,
        product.id,
        product.title,
        product.price,
        product.category,
        product.image
      )
      .first();

    return c.json(saved, 201);

  } catch (e) {
    if (String(e).includes("UNIQUE")) {
      return c.json({
        error: "Produto já está nos favoritos.",
      }, 409);
    }

    throw e;
  }
});

// Remover favorito
app.delete("/clients/:id/favorites/:productId", async (c) => {
  const clientId = parseId(c.req.param("id"));
  const productId = parseId(c.req.param("productId"));

  if (!clientId || !productId) {
    return c.json({ error: "ID inválido." }, 400);
  }

  const result = await c.env.DB.prepare(`
    DELETE FROM favorites
    WHERE client_id = ? AND product_id = ?
  `)
    .bind(clientId, productId)
    .run();

  if (!result.meta.changes) {
    return c.json({
      error: "Favorito não encontrado.",
    }, 404);
  }

  return c.body(null, 204);
});

// ---------- Erros ----------

app.notFound((c) =>
  c.json({ error: "Rota não encontrada." }, 404)
);

app.onError((err, c) => {
  console.error(err);

  return c.json({
    error: "Erro interno.",
    detail: err.message,
  }, 502);
});

export default app;

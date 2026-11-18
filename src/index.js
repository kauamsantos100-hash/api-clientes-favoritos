
import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

const FAKE_STORE = "https://fakestoreapi.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.use("*", cors());

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    key,
    256
  );

  const saltBase64 = btoa(String.fromCharCode(...salt));
  const hashBase64 = btoa(
    String.fromCharCode(...new Uint8Array(hash))
  );

  return `${saltBase64}:${hashBase64}`;
}

async function verifyPassword(password, storedHash) {
  try {
    const [saltBase64, hashBase64] = storedHash.split(":");

    if (!saltBase64 || !hashBase64) {
      return false;
    }

    const salt = Uint8Array.from(
      atob(saltBase64),
      char => char.charCodeAt(0)
    );

    const originalHash = Uint8Array.from(
      atob(hashBase64),
      char => char.charCodeAt(0)
    );

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );

    const result = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations: 100000,
        hash: "SHA-256"
      },
      key,
      256
    );

    const calculatedHash = new Uint8Array(result);

    if (calculatedHash.length !== originalHash.length) {
      return false;
    }

    let difference = 0;

    for (let i = 0; i < calculatedHash.length; i++) {
      difference |= calculatedHash[i] ^ originalHash[i];
    }

    return difference === 0;
  } catch {
    return false;
  }
}

function validateEmail(email) {
  return EMAIL_RE.test(email);
}

// =====================================================
// ROTA INICIAL
// =====================================================

app.get("/", (c) => {
  return c.json({
    message: "API de Clientes e Produtos Favoritos funcionando!",
    endpoints: [
      "POST /clients",
      "POST /login",
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
  });
});

// =====================================================
// AUTENTICAÇÃO
// =====================================================

app.post("/login", async (c) => {
  const body = await c.req.json().catch(() => null);

  const email =
    typeof body?.email === "string"
      ? body.email.trim().toLowerCase()
      : "";

  const password =
    typeof body?.password === "string"
      ? body.password
      : "";

  if (!email || !password) {
    return c.json(
      { error: "Informe o e-mail e a senha." },
      400
    );
  }

  try {
    const client = await c.env.DB.prepare(`
      SELECT id, name, email, password_hash, created_at
      FROM clients
      WHERE LOWER(email) = LOWER(?)
    `)
      .bind(email)
      .first();

    if (!client || !client.password_hash) {
      return c.json(
        { error: "E-mail ou senha incorretos." },
        401
      );
    }

    const validPassword = await verifyPassword(
      password,
      client.password_hash
    );

    if (!validPassword) {
      return c.json(
        { error: "E-mail ou senha incorretos." },
        401
      );
    }

    return c.json({
      message: "Login realizado com sucesso.",
      id: client.id,
      name: client.name,
      email: client.email,
      created_at: client.created_at
    });
  } catch (error) {
    console.error("Erro no login:", error);

    return c.json(
      { error: "Erro ao realizar login." },
      500
    );
  }
});

// =====================================================
// CLIENTES
// =====================================================

// CADASTRAR CLIENTE
app.post("/clients", async (c) => {
  const body = await c.req.json().catch(() => null);

  const name =
    typeof body?.name === "string"
      ? body.name.trim()
      : "";

  const email =
    typeof body?.email === "string"
      ? body.email.trim().toLowerCase()
      : "";

  const password =
    typeof body?.password === "string"
      ? body.password
      : "";

  if (!name || !email || !password) {
    return c.json(
      { error: "Preencha nome, e-mail e senha." },
      400
    );
  }

  if (!validateEmail(email)) {
    return c.json(
      { error: "Informe um e-mail válido." },
      400
    );
  }

  if (password.length < 8) {
    return c.json(
      { error: "A senha deve ter pelo menos 8 caracteres." },
      400
    );
  }

  try {
    const existingClient = await c.env.DB.prepare(`
      SELECT id FROM clients
      WHERE LOWER(email) = LOWER(?)
    `)
      .bind(email)
      .first();

    if (existingClient) {
      return c.json(
        { error: "Este e-mail já está cadastrado." },
        409
      );
    }

    const passwordHash = await hashPassword(password);

    const result = await c.env.DB.prepare(`
      INSERT INTO clients (name, email, password_hash)
      VALUES (?, ?, ?)
    `)
      .bind(name, email, passwordHash)
      .run();

    const client = await c.env.DB.prepare(`
      SELECT id, name, email, created_at
      FROM clients
      WHERE id = ?
    `)
      .bind(result.meta.last_row_id)
      .first();

    return c.json(
      {
        message: "Cliente cadastrado com sucesso!",
        client
      },
      201
    );
  } catch (error) {
    console.error("Erro ao cadastrar cliente:", error);

    return c.json(
      { error: "Erro ao cadastrar cliente." },
      500
    );
  }
});

// LISTAR CLIENTES
app.get("/clients", async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT id, name, email, created_at
      FROM clients
      ORDER BY id DESC
    `).all();

    return c.json(result.results);
  } catch (error) {
    console.error(error);

    return c.json(
      { error: "Erro ao listar clientes." },
      500
    );
  }
});

// BUSCAR CLIENTE POR ID
app.get("/clients/:id", async (c) => {
  const id = Number(c.req.param("id"));

  if (!Number.isInteger(id) || id <= 0) {
    return c.json(
      { error: "ID inválido." },
      400
    );
  }

  try {
    const client = await c.env.DB.prepare(`
      SELECT id, name, email, created_at
      FROM clients
      WHERE id = ?
    `)
      .bind(id)
      .first();

    if (!client) {
      return c.json(
        { error: "Cliente não encontrado." },
        404
      );
    }

    return c.json(client);
  } catch (error) {
    console.error(error);

    return c.json(
      { error: "Erro ao buscar cliente." },
      500
    );
  }
});

// ATUALIZAR CLIENTE
app.put("/clients/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json().catch(() => null);

  if (!Number.isInteger(id) || id <= 0) {
    return c.json(
      { error: "ID inválido." },
      400
    );
  }

  if (!body || typeof body !== "object") {
    return c.json(
      { error: "Dados inválidos." },
      400
    );
  }

  const name =
    typeof body.name === "string"
      ? body.name.trim()
      : "";

  const email =
    typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : "";

  if (!name || !email) {
    return c.json(
      { error: "Informe nome e e-mail." },
      400
    );
  }

  if (!validateEmail(email)) {
    return c.json(
      { error: "Informe um e-mail válido." },
      400
    );
  }

  try {
    const client = await c.env.DB.prepare(`
      SELECT id FROM clients WHERE id = ?
    `)
      .bind(id)
      .first();

    if (!client) {
      return c.json(
        { error: "Cliente não encontrado." },
        404
      );
    }

    const duplicateEmail = await c.env.DB.prepare(`
      SELECT id FROM clients
      WHERE LOWER(email) = LOWER(?) AND id != ?
    `)
      .bind(email, id)
      .first();

    if (duplicateEmail) {
      return c.json(
        { error: "Este e-mail já está sendo utilizado." },
        409
      );
    }

    if (body.password !== undefined) {
      if (
        typeof body.password !== "string" ||
        body.password.length < 8
      ) {
        return c.json(
          { error: "A senha deve ter pelo menos 8 caracteres." },
          400
        );
      }

      const passwordHash = await hashPassword(body.password);

      await c.env.DB.prepare(`
        UPDATE clients
        SET name = ?, email = ?, password_hash = ?
        WHERE id = ?
      `)
        .bind(name, email, passwordHash, id)
        .run();
    } else {
      await c.env.DB.prepare(`
        UPDATE clients
        SET name = ?, email = ?
        WHERE id = ?
      `)
        .bind(name, email, id)
        .run();
    }

    const updatedClient = await c.env.DB.prepare(`
      SELECT id, name, email, created_at
      FROM clients
      WHERE id = ?
    `)
      .bind(id)
      .first();

    return c.json({
      message: "Cliente atualizado com sucesso!",
      client: updatedClient
    });
  } catch (error) {
    console.error(error);

    return c.json(
      { error: "Erro ao atualizar cliente." },
      500
    );
  }
});

// EXCLUIR CLIENTE
app.delete("/clients/:id", async (c) => {
  const id = Number(c.req.param("id"));

  if (!Number.isInteger(id) || id <= 0) {
    return c.json(
      { error: "ID inválido." },
      400
    );
  }

  try {
    const client = await c.env.DB.prepare(`
      SELECT id FROM clients WHERE id = ?
    `)
      .bind(id)
      .first();

    if (!client) {
      return c.json(
        { error: "Cliente não encontrado." },
        404
      );
    }

    await c.env.DB.batch([
      c.env.DB.prepare(`
        DELETE FROM favorites WHERE client_id = ?
      `).bind(id),

      c.env.DB.prepare(`
        DELETE FROM clients WHERE id = ?
      `).bind(id)
    ]);

    return c.json({
      message: "Cliente excluído com sucesso!"
    });
  } catch (error) {
    console.error(error);

    return c.json(
      { error: "Erro ao excluir cliente." },
      500
    );
  }
});

// =====================================================
// PRODUTOS - FAKE STORE API
// =====================================================

// LISTAR PRODUTOS
app.get("/products", async (c) => {
  try {
    const response = await fetch(`${FAKE_STORE}/products`);

    if (!response.ok) {
      return c.json(
        { error: "Erro ao consultar produtos externos." },
        502
      );
    }

    const products = await response.json();

    return c.json(products);
  } catch (error) {
    console.error(error);

    return c.json(
      { error: "Não foi possível carregar os produtos." },
      500
    );
  }
});

// BUSCAR PRODUTO POR ID
app.get("/products/:id", async (c) => {
  const id = Number(c.req.param("id"));

  if (!Number.isInteger(id) || id <= 0) {
    return c.json(
      { error: "ID de produto inválido." },
      400
    );
  }

  try {
    const response = await fetch(
      `${FAKE_STORE}/products/${id}`
    );

    if (response.status === 404) {
      return c.json(
        { error: "Produto não encontrado." },
        404
      );
    }

    if (!response.ok) {
      return c.json(
        { error: "Erro ao consultar produto externo." },
        502
      );
    }

    const product = await response.json();

    return c.json(product);
  } catch (error) {
    console.error(error);

    return c.json(
      { error: "Não foi possível buscar o produto." },
      500
    );
  }
});

// LISTAR CATEGORIAS
app.get("/categories", async (c) => {
  try {
    const response = await fetch(
      `${FAKE_STORE}/products/categories`
    );

    if (!response.ok) {
      return c.json(
        { error: "Erro ao consultar categorias." },
        502
      );
    }

    const categories = await response.json();

    return c.json(categories);
  } catch (error) {
    console.error(error);

    return c.json(
      { error: "Não foi possível carregar as categorias." },
      500
    );
  }
});

// =====================================================
// PRODUTOS FAVORITOS
// =====================================================

// LISTAR FAVORITOS DO CLIENTE
app.get("/clients/:id/favorites", async (c) => {
  const clientId = Number(c.req.param("id"));

  if (!Number.isInteger(clientId) || clientId <= 0) {
    return c.json(
      { error: "ID do cliente inválido." },
      400
    );
  }

  try {
    const client = await c.env.DB.prepare(`
      SELECT id FROM clients WHERE id = ?
    `)
      .bind(clientId)
      .first();

    if (!client) {
      return c.json(
        { error: "Cliente não encontrado." },
        404
      );
    }

    const result = await c.env.DB.prepare(`
      SELECT
        id,
        client_id,
        product_id,
        title,
        price,
        category,
        image,
        created_at
      FROM favorites
      WHERE client_id = ?
      ORDER BY id DESC
    `)
      .bind(clientId)
      .all();

    return c.json(result.results);
  } catch (error) {
    console.error(error);

    return c.json(
      { error: "Erro ao buscar favoritos." },
      500
    );
  }
});

// ADICIONAR PRODUTO AOS FAVORITOS
app.post("/clients/:id/favorites", async (c) => {
  const clientId = Number(c.req.param("id"));
  const body = await c.req.json().catch(() => null);

  if (!Number.isInteger(clientId) || clientId <= 0) {
    return c.json(
      { error: "ID do cliente inválido." },
      400
    );
  }

  const productId = Number(body?.product_id);

  if (!Number.isInteger(productId) || productId <= 0) {
    return c.json(
      { error: "Informe um ID de produto válido." },
      400
    );
  }

  try {
    const client = await c.env.DB.prepare(`
      SELECT id FROM clients WHERE id = ?
    `)
      .bind(clientId)
      .first();

    if (!client) {
      return c.json(
        { error: "Cliente não encontrado." },
        404
      );
    }

    const existingFavorite = await c.env.DB.prepare(`
      SELECT id FROM favorites
      WHERE client_id = ? AND product_id = ?
    `)
      .bind(clientId, productId)
      .first();

    if (existingFavorite) {
      return c.json(
        { error: "Este produto já está nos favoritos." },
        409
      );
    }

    const response = await fetch(
      `${FAKE_STORE}/products/${productId}`
    );

    if (response.status === 404) {
      return c.json(
        { error: "Produto não encontrado na loja." },
        404
      );
    }

    if (!response.ok) {
      return c.json(
        { error: "Erro ao consultar produto externo." },
        502
      );
    }

    const product = await response.json();

    await c.env.DB.prepare(`
      INSERT INTO favorites (
        client_id,
        product_id,
        title,
        price,
        category,
        image
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `)
      .bind(
        clientId,
        product.id,
        product.title,
        product.price,
        product.category,
        product.image
      )
      .run();

    return c.json(
      {
        message: "Produto adicionado aos favoritos!",
        product
      },
      201
    );
  } catch (error) {
    console.error(error);

    return c.json(
      { error: "Erro ao adicionar favorito." },
      500
    );
  }
});

// REMOVER PRODUTO DOS FAVORITOS
app.delete(
  "/clients/:id/favorites/:productId",
  async (c) => {
    const clientId = Number(c.req.param("id"));
    const productId = Number(c.req.param("productId"));

    if (
      !Number.isInteger(clientId) ||
      clientId <= 0 ||
      !Number.isInteger(productId) ||
      productId <= 0
    ) {
      return c.json(
        { error: "ID inválido." },
        400
      );
    }

    try {
      const favorite = await c.env.DB.prepare(`
        SELECT id FROM favorites
        WHERE client_id = ? AND product_id = ?
      `)
        .bind(clientId, productId)
        .first();

      if (!favorite) {
        return c.json(
          { error: "Favorito não encontrado." },
          404
        );
      }

      await c.env.DB.prepare(`
        DELETE FROM favorites
        WHERE client_id = ? AND product_id = ?
      `)
        .bind(clientId, productId)
        .run();

      return c.json({
        message: "Produto removido dos favoritos!"
      });
    } catch (error) {
      console.error(error);

      return c.json(
        { error: "Erro ao remover favorito." },
        500
      );
    }
  }
);

// =====================================================
// TRATAMENTO DE ERROS
// =====================================================

app.notFound((c) => {
  return c.json(
    { error: "Rota não encontrada." },
    404
  );
});

app.onError((error, c) => {
  console.error("Erro interno:", error);

  return c.json(
    { error: "Erro interno do servidor." },
    500
  );
});

export default app;

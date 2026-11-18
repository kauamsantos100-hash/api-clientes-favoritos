
const API = "https://api-clientes-favoritos.kauamsantos100.workers.dev";

const $ = (selector) => document.querySelector(selector);

const state = {
  products: [],
  categories: [],
  favorites: [],
  client: null,
  currentProduct: null
};

let toastTimer;

// =====================================================
// NOTIFICAÇÕES
// =====================================================

function toast(message, error = false) {
  const el = $("#toast");

  el.textContent = message;
  el.className = `toast show${error ? " error" : ""}`;

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    el.className = "toast";
  }, 3200);
}

// =====================================================
// REQUISIÇÕES À API
// =====================================================

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || `Erro na requisição (${response.status})`
    );
  }

  return data;
}

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

// Normaliza os nomes dos campos de favoritos
function normalizeFavorite(favorite) {
  return {
    ...favorite,
    productId: Number(
      favorite.productId ?? favorite.product_id
    ),
    clientId: Number(
      favorite.clientId ?? favorite.client_id
    )
  };
}

// =====================================================
// NAVEGAÇÃO
// =====================================================

function showView(view) {
  document.querySelectorAll(".view").forEach(el => {
    el.classList.toggle(
      "active",
      el.id === `${view}-view`
    );
  });

  document.querySelectorAll(".nav-link").forEach(el => {
    el.classList.toggle(
      "active",
      el.dataset.view === view
    );
  });

  $("#breadcrumb-current").textContent = {
    catalog: "Catálogo",
    favorites: "Meus favoritos",
    profile: "Meu cadastro"
  }[view];

  if (view === "favorites") loadFavorites();

  if (view === "profile") renderProfile();
}

// =====================================================
// MODAIS
// =====================================================

function openModal(id) {
  $(`#${id}`).classList.add("open");
}

function closeModal(id) {
  $(`#${id}`).classList.remove("open");
}

// =====================================================
// CLIENTE
// =====================================================

function setClient(client) {
  state.client = client;

  localStorage.setItem(
    "favoritaClientId",
    client.id
  );

  $("#header-user").textContent =
    client.name.split(" ")[0];

  $("#avatar-letter").textContent =
    client.name.charAt(0).toUpperCase();

  $("#change-client").textContent = "Trocar cadastro";

  renderProfile();
  updateFavoriteCount();

  loadFavorites();
}

// Carregar cliente pelo ID internamente
async function accessClient(id) {
  const client = await request(`/clients/${id}`);

  setClient(client);

  closeModal("client-modal");

  toast(`Olá, ${client.name.split(" ")[0]}!`);
}

// =====================================================
// PRODUTOS
// =====================================================

async function loadProducts() {
  $("#product-grid").innerHTML =
    '<div class="loading">Carregando produtos...</div>';

  try {
    const [products, categories] = await Promise.all([
      request("/products"),
      request("/categories")
    ]);

    state.products = products;
    state.categories = categories;

    $("#category-filter").innerHTML =
      '<option value="">Todas as categorias</option>' +
      categories.map(category => `
        <option value="${escapeHtml(category)}">
          ${escapeHtml(category)}
        </option>
      `).join("");

    renderProducts();

  } catch (error) {
    $("#product-grid").innerHTML = `
      <div class="empty-state">
        <strong>Não foi possível carregar o catálogo.</strong>
        ${escapeHtml(error.message)}
        <br>
        Atualize a página para tentar novamente.
      </div>
    `;
  }
}

// =====================================================
// CARD DE PRODUTO
// =====================================================

function productCard(product) {
  const saved = state.favorites.some(
    favorite =>
      Number(favorite.productId) === Number(product.id)
  );

  return `
    <article class="product-card">

      <div class="product-image" data-detail="${product.id}">

        <img
          src="${escapeHtml(product.image)}"
          alt="${escapeHtml(product.title)}"
          loading="lazy"
        >

        <button
          class="heart-btn ${saved ? "saved" : ""}"
          data-favorite="${product.id}"
          title="${saved ? "Remover dos favoritos" : "Adicionar aos favoritos"}"
        >
          ${saved ? "♥" : "♡"}
        </button>

      </div>

      <div class="product-category">
        ${escapeHtml(product.category || "Produto")}
      </div>

      <div class="product-title" data-detail="${product.id}">
        ${escapeHtml(product.title)}
      </div>

      <div class="product-bottom">

        <span class="price">
          ${money(product.price)}
        </span>

        <button
          class="detail-link"
          data-detail="${product.id}"
        >
          Ver detalhes →
        </button>

      </div>

    </article>
  `;
}

// =====================================================
// RENDERIZAR PRODUTOS
// =====================================================

function renderProducts() {
  const q = $("#search-input").value.trim().toLowerCase();
  const category = $("#category-filter").value;

  const list = state.products.filter(product => {
    const matchesCategory =
      !category || product.category === category;

    const matchesSearch =
      !q || product.title.toLowerCase().includes(q);

    return matchesCategory && matchesSearch;
  });

  $("#product-grid").innerHTML = list.length
    ? list.map(product => productCard(product)).join("")
    : `
      <div class="empty-state">
        <strong>Nenhum produto encontrado.</strong>
        Tente mudar sua busca ou categoria.
      </div>
    `;
}

// =====================================================
// FAVORITOS
// =====================================================

async function loadFavorites() {
  if (!state.client) {
    $("#favorites-grid").innerHTML = `
      <div class="empty-state">
        <strong>Acesse sua conta primeiro.</strong>
        Entre com seu e-mail e senha para ver seus favoritos.
      </div>
    `;

    state.favorites = [];
    updateFavoriteCount();

    return;
  }

  $("#favorites-grid").innerHTML =
    '<div class="loading">Carregando seus favoritos...</div>';

  try {
    const favorites = await request(
      `/clients/${state.client.id}/favorites`
    );

    state.favorites = favorites.map(normalizeFavorite);

    updateFavoriteCount();

    $("#favorites-grid").innerHTML =
      state.favorites.length
        ? state.favorites.map(favorite => productCard({
            id: favorite.productId,
            title: favorite.title,
            price: favorite.price,
            category: favorite.category,
            image: favorite.image
          })).join("")
        : `
          <div class="empty-state">
            <strong>Sua coleção ainda está vazia.</strong>
            Explore o catálogo e toque no coração
            para salvar um produto.
          </div>
        `;

    renderProducts();

  } catch (error) {
    $("#favorites-grid").innerHTML = `
      <div class="empty-state">
        <strong>Erro ao carregar favoritos.</strong>
        ${escapeHtml(error.message)}
      </div>
    `;
  }
}

// =====================================================
// CONTADOR DE FAVORITOS
// =====================================================

function updateFavoriteCount() {
  $("#favorite-count").textContent =
    state.favorites.length;
}

// =====================================================
// ADICIONAR E REMOVER FAVORITOS
// =====================================================

async function toggleFavorite(id) {
  if (!state.client) {
    toast("Entre na sua conta para favoritar produtos.", true);
    openModal("client-modal");
    return;
  }

  const productId = Number(id);

  const exists = state.favorites.some(
    favorite =>
      Number(favorite.productId) === productId
  );

  try {
    if (exists) {
      await request(
        `/clients/${state.client.id}/favorites/${productId}`,
        {
          method: "DELETE"
        }
      );

      state.favorites = state.favorites.filter(
        favorite =>
          Number(favorite.productId) !== productId
      );

      toast("Produto removido dos favoritos.");

    } else {
      await request(
        `/clients/${state.client.id}/favorites`,
        {
          method: "POST",
          body: JSON.stringify({
            product_id: productId
          })
        }
      );

      toast("Produto adicionado aos favoritos!");

      // Atualiza a lista com os dados reais do D1
      await loadFavorites();
    }

    updateFavoriteCount();
    renderProducts();

    if ($("#favorites-view").classList.contains("active")) {
      await loadFavorites();
    }

    if ($("#product-modal").classList.contains("open")) {
      await showProduct(productId);
    }

  } catch (error) {
    toast(error.message, true);
  }
}

// =====================================================
// DETALHES DO PRODUTO
// =====================================================

async function showProduct(id) {
  try {
    const product = await request(`/products/${id}`);

    state.currentProduct = product;

    const saved = state.favorites.some(
      favorite =>
        Number(favorite.productId) === Number(product.id)
    );

    $("#product-detail").innerHTML = `
      <div class="detail-layout">

        <div class="detail-image">
          <img
            src="${escapeHtml(product.image)}"
            alt="${escapeHtml(product.title)}"
          >
        </div>

        <div class="detail-copy">

          <span class="eyebrow">
            ${escapeHtml(product.category)}
          </span>

          <h2>
            ${escapeHtml(product.title)}
          </h2>

          <div class="detail-price">
            ${money(product.price)}
          </div>

          <p>
            ${escapeHtml(product.description)}
          </p>

          <p>
            ★ ${Number(product.rating?.rate || 0).toFixed(1)}
            · ${Number(product.rating?.count || 0)} avaliações
          </p>

          <button
            class="primary-btn"
            data-favorite="${product.id}"
          >
            ${saved
              ? "♥ Remover dos favoritos"
              : "♡ Adicionar aos favoritos"}
          </button>

        </div>

      </div>
    `;

    openModal("product-modal");

  } catch (error) {
    toast(error.message, true);
  }
}

// =====================================================
// PERFIL DO CLIENTE
// =====================================================

function renderProfile() {
  if (!state.client) {
    $("#profile-name").textContent =
      "Nenhum cliente selecionado";

    $("#profile-id").textContent =
      "Entre na sua conta para começar";

    $("#profile-avatar").textContent = "?";

    $("#profile-name-input").value = "";
    $("#profile-email-input").value = "";
    $("#profile-password-input").value = "";

    return;
  }

  $("#profile-name").textContent = state.client.name;

  $("#profile-id").textContent =
    `Cliente #${state.client.id}`;

  $("#profile-avatar").textContent =
    state.client.name.charAt(0).toUpperCase();

  $("#profile-name-input").value =
    state.client.name;

  $("#profile-email-input").value =
    state.client.email;

  $("#profile-password-input").value = "";
}

// =====================================================
// EVENTOS DE CLIQUE
// =====================================================

document.addEventListener("click", async event => {

  const nav = event.target.closest("[data-view]");

  if (nav) {
    showView(nav.dataset.view);
  }

  const detail = event.target.closest("[data-detail]");

  if (detail) {
    showProduct(detail.dataset.detail);
  }

  const favorite = event.target.closest("[data-favorite]");

  if (favorite) {
    event.stopPropagation();
    toggleFavorite(favorite.dataset.favorite);
  }

  const close = event.target.closest("[data-close]");

  if (close) {
    closeModal(close.dataset.close);
  }

  const tab = event.target.closest("[data-tab]");

  if (tab) {
    document.querySelectorAll(".tab").forEach(button => {
      button.classList.toggle("active", button === tab);
    });

    $("#register-form").classList.toggle(
      "hidden",
      tab.dataset.tab !== "register"
    );

    $("#existing-form").classList.toggle(
      "hidden",
      tab.dataset.tab !== "existing"
    );
  }
});

// =====================================================
// FECHAR MODAIS AO CLICAR FORA
// =====================================================

document.querySelectorAll(".modal-backdrop").forEach(modal => {
  modal.addEventListener("click", event => {
    if (event.target === modal) {
      modal.classList.remove("open");
    }
  });
});

// =====================================================
// BUSCA E FILTROS
// =====================================================

$("#search-input").addEventListener("input", renderProducts);

$("#category-filter").addEventListener("change", renderProducts);

$("#explore-btn").addEventListener("click", () => {
  $("#search-input").focus();
});

// =====================================================
// TROCAR CONTA
// =====================================================

$("#change-client").addEventListener("click", () => {
  // Começa mostrando a aba de login
  document.querySelectorAll(".tab").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.tab === "existing"
    );
  });

  $("#register-form").classList.add("hidden");
  $("#existing-form").classList.remove("hidden");

  openModal("client-modal");
});

// =====================================================
// CADASTRAR CLIENTE
// =====================================================

$("#register-form").addEventListener("submit", async event => {
  event.preventDefault();

  const body = {
    name: $("#register-name").value.trim(),
    email: $("#register-email").value.trim(),
    password: $("#register-password").value
  };

  if (
    body.name.length < 2 ||
    !body.email.includes("@") ||
    body.password.length < 8
  ) {
    toast(
      "Confira os campos. A senha precisa ter pelo menos 8 caracteres.",
      true
    );

    return;
  }

  try {
    const response = await request("/clients", {
      method: "POST",
      body: JSON.stringify(body)
    });

    // O backend retorna o cliente dentro de response.client
    const client = response.client;

    if (!client || !client.id) {
      throw new Error("Resposta inválida do servidor.");
    }

    setClient(client);

    closeModal("client-modal");

    event.target.reset();

    toast("Cadastro realizado com sucesso!");

  } catch (error) {
    toast(error.message, true);
  }
});

// =====================================================
// LOGIN COM E-MAIL E SENHA
// =====================================================

$("#existing-form").addEventListener("submit", async event => {
  event.preventDefault();

  const email = $("#login-email").value.trim();

  const password = $("#login-password").value;

  if (!email || !password) {
    toast("Informe seu e-mail e sua senha.", true);
    return;
  }

  try {
    const response = await request("/login", {
      method: "POST",
      body: JSON.stringify({
        email,
        password
      })
    });

    if (!response.id) {
      throw new Error("Não foi possível identificar sua conta.");
    }

    // Carrega os dados completos do cliente
    await accessClient(response.id);

    event.target.reset();

    toast("Login realizado com sucesso!");

  } catch (error) {
    toast(error.message, true);
  }
});

// =====================================================
// ATUALIZAR CADASTRO
// =====================================================

$("#profile-form").addEventListener("submit", async event => {
  event.preventDefault();

  if (!state.client) {
    toast("Acesse sua conta primeiro.", true);
    openModal("client-modal");
    return;
  }

  const body = {
    name: $("#profile-name-input").value.trim(),
    email: $("#profile-email-input").value.trim()
  };

  const newPassword = $("#profile-password-input").value;

  if (newPassword) {
    body.password = newPassword;
  }

  try {
    const response = await request(
      `/clients/${state.client.id}`,
      {
        method: "PUT",
        body: JSON.stringify(body)
      }
    );

    const updatedClient = response.client;

    if (!updatedClient) {
      throw new Error("Não foi possível atualizar o cadastro.");
    }

    setClient(updatedClient);

    toast("Cadastro atualizado com sucesso!");

  } catch (error) {
    toast(error.message, true);
  }
});

// =====================================================
// EXCLUIR CLIENTE
// =====================================================

$("#delete-client").addEventListener("click", async () => {

  if (!state.client) {
    toast("Nenhum cadastro selecionado.", true);
    return;
  }

  const confirmed = confirm(
    "Tem certeza que deseja excluir seu cadastro e todos os favoritos? Essa ação não pode ser desfeita."
  );

  if (!confirmed) return;

  try {
    await request(
      `/clients/${state.client.id}`,
      {
        method: "DELETE"
      }
    );

    localStorage.removeItem("favoritaClientId");

    state.client = null;
    state.favorites = [];

    $("#header-user").textContent = "Visitante";
    $("#avatar-letter").textContent = "?";

    $("#change-client").textContent = "Entrar / Cadastrar";

    renderProfile();
    updateFavoriteCount();
    renderProducts();

    toast("Cadastro excluído com sucesso!");

  } catch (error) {
    toast(error.message, true);
  }
});

// =====================================================
// INICIALIZAÇÃO
// =====================================================

(async function init() {

  await loadProducts();

  // Recupera a conta utilizada anteriormente neste navegador
  const savedId = localStorage.getItem("favoritaClientId");

  if (savedId) {
    try {
      await accessClient(savedId);

    } catch (error) {
      localStorage.removeItem("favoritaClientId");

      openModal("client-modal");
    }

  } else {
    // Primeiro acesso: mostrar cadastro e login
    openModal("client-modal");
  }

})();

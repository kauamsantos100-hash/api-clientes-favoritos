const API = "https://api-clientes-favoritos.kauamsantos100.workers.dev";
const $ = (s) => document.querySelector(s);
const state = { products: [], categories: [], favorites: [], client: null, currentProduct: null };
let toastTimer;

function toast(message, error = false) {
  const el = $("#toast"); el.textContent = message; el.className = `toast show${error ? " error" : ""}`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.className = "toast", 3200);
}
async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Erro na requisição (${response.status})`);
  return data;
}
function money(value) { return Number(value || 0).toLocaleString("pt-BR", {style:"currency",currency:"BRL"}); }
function escapeHtml(value="") { return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function showView(view) {
  document.querySelectorAll(".view").forEach(el => el.classList.toggle("active", el.id === `${view}-view`));
  document.querySelectorAll(".nav-link").forEach(el => el.classList.toggle("active", el.dataset.view === view));
  $("#breadcrumb-current").textContent = ({catalog:"Catálogo",favorites:"Meus favoritos",profile:"Meu cadastro"})[view];
  if (view === "favorites") loadFavorites();
  if (view === "profile") renderProfile();
}
function openModal(id) { $(`#${id}`).classList.add("open"); }
function closeModal(id) { $(`#${id}`).classList.remove("open"); }
function setClient(client) {
  state.client = client; localStorage.setItem("favoritaClientId", client.id);
  $("#header-user").textContent = client.name.split(" ")[0];
  $("#avatar-letter").textContent = client.name.charAt(0).toUpperCase();
  $("#change-client").textContent = "Trocar cadastro";
  renderProfile(); updateFavoriteCount();
}
async function accessClient(id) {
  const client = await request(`/clients/${id}`);
  setClient(client); closeModal("client-modal"); toast(`Olá, ${client.name.split(" ")[0]}! Cadastro carregado.`);
}
async function loadProducts() {
  $("#product-grid").innerHTML = '<div class="loading">Carregando produtos...</div>';
  try {
    const [products, categories] = await Promise.all([request("/products"), request("/categories")]);
    state.products = products; state.categories = categories;
    $("#category-filter").innerHTML = '<option value="">Todas as categorias</option>' + categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
    renderProducts();
  } catch (e) { $("#product-grid").innerHTML = `<div class="empty-state"><strong>Não foi possível carregar o catálogo.</strong>${escapeHtml(e.message)}<br>Atualize a página para tentar novamente.</div>`; }
}
function productCard(p, favorite = false) {
  const saved = state.favorites.some(f => Number(f.productId) === Number(p.id));
  return `<article class="product-card">
    <div class="product-image" data-detail="${p.id}"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.title)}" loading="lazy">
      <button class="heart-btn ${saved ? "saved" : ""}" data-favorite="${p.id}" title="${saved ? "Remover dos favoritos" : "Adicionar aos favoritos"}">${saved ? "♥" : "♡"}</button>
    </div>
    <div class="product-category">${escapeHtml(p.category || "Produto")}</div>
    <div class="product-title" data-detail="${p.id}">${escapeHtml(p.title)}</div>
    <div class="product-bottom"><span class="price">${money(p.price)}</span><button class="detail-link" data-detail="${p.id}">Ver detalhes →</button></div>
  </article>`;
}
function renderProducts() {
  const q = $("#search-input").value.trim().toLowerCase(), cat = $("#category-filter").value;
  const list = state.products.filter(p => (!cat || p.category === cat) && (!q || p.title.toLowerCase().includes(q)));
  $("#product-grid").innerHTML = list.length ? list.map(p => productCard(p)).join("") : '<div class="empty-state"><strong>Nenhum produto encontrado.</strong>Tente mudar sua busca ou categoria.</div>';
}
async function loadFavorites() {
  if (!state.client) { $("#favorites-grid").innerHTML = '<div class="empty-state"><strong>Acesse seu cadastro primeiro.</strong>Informe seu ID ou crie uma conta para ver seus favoritos.</div>'; return; }
  $("#favorites-grid").innerHTML = '<div class="loading">Carregando seus favoritos...</div>';
  try {
    state.favorites = await request(`/clients/${state.client.id}/favorites`);
    updateFavoriteCount();
    $("#favorites-grid").innerHTML = state.favorites.length ? state.favorites.map(f => productCard({id:f.productId,title:f.title,price:f.price,category:f.category,image:f.image}, true)).join("") : '<div class="empty-state"><strong>Sua coleção ainda está vazia.</strong>Explore o catálogo e toque no coração para salvar um produto.</div>';
  } catch(e) { $("#favorites-grid").innerHTML = `<div class="empty-state"><strong>Erro ao carregar favoritos.</strong>${escapeHtml(e.message)}</div>`; }
}
function updateFavoriteCount() {
  $("#favorite-count").textContent = state.favorites.length;
}
async function toggleFavorite(id) {
  if (!state.client) { toast("Crie um cadastro ou informe seu ID para favoritar.", true); openModal("client-modal"); return; }
  const exists = state.favorites.some(f => Number(f.productId) === Number(id));
  try {
    if (exists) {
      await request(`/clients/${state.client.id}/favorites/${id}`, {method:"DELETE"});
      state.favorites = state.favorites.filter(f => Number(f.productId) !== Number(id));
      toast("Produto removido dos favoritos.");
    } else {
      const saved = await request(`/clients/${state.client.id}/favorites`, {method:"POST",body:JSON.stringify({productId:Number(id)})});
      state.favorites.unshift(saved); toast("Produto adicionado aos favoritos!");
    }
    updateFavoriteCount(); renderProducts();
    if ($("#favorites-view").classList.contains("active")) loadFavorites();
    if ($("#product-modal").classList.contains("open")) showProduct(id);
  } catch(e) { toast(e.message, true); }
}
async function showProduct(id) {
  try {
    const p = await request(`/products/${id}`); state.currentProduct = p;
    const saved = state.favorites.some(f => Number(f.productId) === Number(p.id));
    $("#product-detail").innerHTML = `<div class="detail-layout"><div class="detail-image"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.title)}"></div><div class="detail-copy"><span class="eyebrow">${escapeHtml(p.category)}</span><h2>${escapeHtml(p.title)}</h2><div class="detail-price">${money(p.price)}</div><p>${escapeHtml(p.description)}</p><p>★ ${Number(p.rating?.rate || 0).toFixed(1)} · ${Number(p.rating?.count || 0)} avaliações</p><button class="primary-btn" data-favorite="${p.id}">${saved ? "♥ Remover dos favoritos" : "♡ Adicionar aos favoritos"}</button></div></div>`;
    openModal("product-modal");
  } catch(e) { toast(e.message, true); }
}
function renderProfile() {
  if (!state.client) { $("#profile-name").textContent = "Nenhum cliente selecionado"; $("#profile-id").textContent = "Cadastre-se para começar"; return; }
  $("#profile-name").textContent = state.client.name; $("#profile-id").textContent = `Cliente #${state.client.id}`;
  $("#profile-avatar").textContent = state.client.name.charAt(0).toUpperCase();
  $("#profile-name-input").value = state.client.name; $("#profile-email-input").value = state.client.email;
  $("#profile-password-input").value = "";
}
document.addEventListener("click", async e => {
  const nav = e.target.closest("[data-view]"); if (nav) showView(nav.dataset.view);
  const detail = e.target.closest("[data-detail]"); if (detail) showProduct(detail.dataset.detail);
  const fav = e.target.closest("[data-favorite]"); if (fav) { e.stopPropagation(); toggleFavorite(fav.dataset.favorite); }
  const close = e.target.closest("[data-close]"); if (close) closeModal(close.dataset.close);
  const tab = e.target.closest("[data-tab]"); if (tab) {
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active",t===tab));
    $("#register-form").classList.toggle("hidden",tab.dataset.tab!=="register");
    $("#existing-form").classList.toggle("hidden",tab.dataset.tab!=="existing");
  }
});
document.querySelectorAll(".modal-backdrop").forEach(m => m.addEventListener("click",e => {if(e.target===m) m.classList.remove("open");}));
$("#search-input").addEventListener("input",renderProducts);
$("#category-filter").addEventListener("change",renderProducts);
$("#explore-btn").addEventListener("click",()=>$("#search-input").focus());
$("#change-client").addEventListener("click",()=>openModal("client-modal"));
$("#register-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const body={name:$("#register-name").value.trim(),email:$("#register-email").value.trim(),password:$("#register-password").value};
  if(body.name.length<2||!body.email.includes("@")||body.password.length<8){toast("Confira os campos. A senha precisa ter pelo menos 8 caracteres.",true);return;}
  try {const client=await request("/clients",{method:"POST",body:JSON.stringify(body)});setClient(client);closeModal("client-modal");e.target.reset();toast("Cadastro realizado com sucesso!");}
  catch(err){toast(err.message,true);}
});
$("#existing-form").addEventListener("submit",async e=>{e.preventDefault();try{await accessClient($("#existing-id").value);}catch(err){toast(err.message,true);}});
$("#profile-form").addEventListener("submit",async e=>{
  e.preventDefault();if(!state.client){toast("Acesse um cadastro primeiro.",true);openModal("client-modal");return;}
  const body={name:$("#profile-name-input").value.trim(),email:$("#profile-email-input").value.trim()};
  if($("#profile-password-input").value) body.password=$("#profile-password-input").value;
  try {const updated=await request(`/clients/${state.client.id}`,{method:"PUT",body:JSON.stringify(body)});setClient(updated);toast("Cadastro atualizado!");}
  catch(err){toast(err.message,true);}
});
$("#delete-client").addEventListener("click",async()=>{
  if(!state.client){toast("Nenhum cadastro selecionado.",true);return;}
  if(!confirm("Tem certeza que deseja excluir seu cadastro e todos os favoritos? Essa ação não pode ser desfeita."))return;
  try{await request(`/clients/${state.client.id}`,{method:"DELETE"});localStorage.removeItem("favoritaClientId");state.client=null;state.favorites=[];$("#header-user").textContent="Visitante";$("#avatar-letter").textContent="?";$("#change-client").textContent="Acessar cadastro";renderProfile();updateFavoriteCount();toast("Cadastro excluído.");}
  catch(err){toast(err.message,true);}
});
(async function init(){
  await loadProducts();
  const savedId=localStorage.getItem("favoritaClientId");
  if(savedId){try{await accessClient(savedId);}catch{localStorage.removeItem("favoritaClientId");openModal("client-modal");}}
  else openModal("client-modal");
})();
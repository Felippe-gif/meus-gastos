// Meus Gastos — tudo fica salvo no próprio aparelho (localStorage).
// Não precisa de servidor nem de internet depois de instalado.

const CHAVE = "meus-gastos.v1";

const CATEGORIAS = {
  gasto: [
    ["Alimentação", "🍔"], ["Mercado", "🛒"], ["Transporte", "🚗"], ["Lazer", "🎮"],
    ["Faculdade", "🎓"], ["Contas", "🧾"], ["Compras", "🛍️"], ["Saúde", "💊"],
    ["Assinaturas", "📺"], ["Presentes", "🎁"], ["Cuidados", "💈"], ["Outros", "📦"],
  ],
  entrada: [
    ["Salário", "💼"], ["Freela", "💻"], ["Vendas", "🏷️"], ["Presente", "🎁"],
    ["Reembolso", "↩️"], ["Outros", "💰"],
  ],
};

const CORES = ["#7c83ff", "#f87171", "#fbbf24", "#34d399", "#60a5fa", "#f472b6",
  "#a78bfa", "#fb923c", "#2dd4bf", "#facc15", "#c084fc", "#94a3b8"];

// ---------------------------------------------------------------- dados
function carregar() {
  try {
    const d = JSON.parse(localStorage.getItem(CHAVE));
    if (d && Array.isArray(d.lancamentos)) return { orcamento: 0, ...d };
  } catch (e) { /* dado quebrado: começa do zero */ }
  return { lancamentos: [], orcamento: 0 };
}
function salvarDados() { localStorage.setItem(CHAVE, JSON.stringify(dados)); }

let dados = carregar();
let mesAtual = hojeISO().slice(0, 7);   // "2026-11"
let filtroCat = "Todas";
let editandoId = null;
let tipoForm = "gasto";
let catForm = null;

// Pede pro navegador não apagar os dados sozinho
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();

// ---------------------------------------------------------------- utilidades
function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const reais = (centavos) => fmt.format(centavos / 100);

// "1.234,56" / "12,5" / "12.50" -> centavos (inteiro)
function lerValor(txt) {
  let s = String(txt).trim().replace(/[R$\s]/g, "");
  if (!s) return NaN;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}
const valorParaTexto = (c) => (c / 100).toFixed(2).replace(".", ",");

function esc(t) {
  return String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function emojiDe(tipo, cat) {
  const achado = (CATEGORIAS[tipo] || []).find(([n]) => n === cat);
  return achado ? achado[1] : "📦";
}
function nomeMes(ym) {
  const [a, m] = ym.split("-").map(Number);
  const t = new Date(a, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function nomeDia(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  const data = new Date(a, m - 1, d);
  const hoje = hojeISO();
  const ontem = new Date(); ontem.setDate(ontem.getDate() - 1);
  const ontemISO = `${ontem.getFullYear()}-${String(ontem.getMonth() + 1).padStart(2, "0")}-${String(ontem.getDate()).padStart(2, "0")}`;
  if (iso === hoje) return "Hoje";
  if (iso === ontemISO) return "Ontem";
  return data.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
}
function mudarMes(delta) {
  const [a, m] = mesAtual.split("-").map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  mesAtual = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  desenhar();
}
function avisar(msg) {
  const el = document.getElementById("aviso");
  el.textContent = msg;
  el.classList.add("mostrar");
  clearTimeout(avisar.t);
  avisar.t = setTimeout(() => el.classList.remove("mostrar"), 2200);
}
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- desenho
function doMes() {
  return dados.lancamentos
    .filter((l) => l.data.startsWith(mesAtual))
    .sort((a, b) => (b.data + b.criado).localeCompare(a.data + a.criado));
}

function htmlItem(l) {
  const sinal = l.tipo === "gasto" ? "−" : "+";
  const cor = l.tipo === "gasto" ? "vermelho" : "verde";
  const titulo = l.descricao || l.categoria;
  return `<button class="item" data-id="${l.id}">
    <div class="emoji">${emojiDe(l.tipo, l.categoria)}</div>
    <div class="meio"><div>${esc(titulo)}</div><small>${esc(l.categoria)} · ${esc(l.pagamento)}</small></div>
    <div class="valor ${cor}">${sinal} ${reais(l.valor)}</div>
  </button>`;
}

function desenhar() {
  $("tituloMes").textContent = nomeMes(mesAtual);
  const lista = doMes();
  const gastos = lista.filter((l) => l.tipo === "gasto");
  const totG = gastos.reduce((s, l) => s + l.valor, 0);
  const totE = lista.filter((l) => l.tipo === "entrada").reduce((s, l) => s + l.valor, 0);
  const saldo = totE - totG;

  $("totGastos").textContent = reais(totG);
  $("totEntradas").textContent = reais(totE);
  $("totSaldo").textContent = reais(saldo);
  $("totSaldo").className = saldo < 0 ? "vermelho" : "";

  // Limite do mês
  const orc = dados.orcamento || 0;
  $("cartaoOrcamento").hidden = !orc;
  if (orc) {
    const pct = Math.min(100, (totG / orc) * 100);
    $("orcTexto").textContent = `${reais(totG)} de ${reais(orc)}`;
    $("orcBarra").style.width = pct + "%";
    $("orcBarra").style.background = pct >= 100 ? "var(--vermelho)" : pct >= 80 ? "var(--amarelo)" : "var(--verde)";
    const sobra = orc - totG;
    let dica;
    if (sobra < 0) {
      dica = `Passou ${reais(-sobra)} do limite. Bora segurar! 😬`;
    } else if (mesAtual === hojeISO().slice(0, 7)) {
      const [a, m] = mesAtual.split("-").map(Number);
      const diasNoMes = new Date(a, m, 0).getDate();
      const diasRestantes = diasNoMes - new Date().getDate() + 1;
      dica = `Ainda pode gastar ${reais(sobra)} — cerca de ${reais(Math.floor(sobra / diasRestantes))} por dia.`;
    } else {
      dica = `Sobrou ${reais(sobra)} do limite.`;
    }
    $("orcDica").textContent = dica;
  }

  // Por categoria
  const porCat = {};
  gastos.forEach((l) => { porCat[l.categoria] = (porCat[l.categoria] || 0) + l.valor; });
  const ordem = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  $("porCategoria").innerHTML = ordem.length
    ? ordem.map(([cat, v], i) => `
      <div class="cat-linha">
        <div class="linha"><span>${emojiDe("gasto", cat)} ${esc(cat)}</span><span>${reais(v)} <small>(${Math.round((v / totG) * 100)}%)</small></span></div>
        <div class="barra"><div style="width:${(v / ordem[0][1]) * 100}%;background:${CORES[i % CORES.length]}"></div></div>
      </div>`).join("")
    : `<div class="vazio">Nenhum gasto neste mês ainda.<br>Toque no <b>+</b> para começar.</div>`;

  // Últimos
  $("ultimos").innerHTML = lista.length
    ? lista.slice(0, 5).map(htmlItem).join("")
    : `<div class="vazio">Sem lançamentos.</div>`;

  desenharLista(lista);
}

function desenharLista(listaMes) {
  // Filtros de categoria (só as que aparecem no mês)
  const cats = ["Todas", ...new Set(listaMes.map((l) => l.categoria))];
  if (!cats.includes(filtroCat)) filtroCat = "Todas";
  $("filtros").innerHTML = cats.map((c) =>
    `<button class="chip ${c === filtroCat ? "ativo" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");

  const termo = $("busca").value.trim().toLowerCase();
  const itens = listaMes.filter((l) =>
    (filtroCat === "Todas" || l.categoria === filtroCat) &&
    (!termo || `${l.descricao} ${l.categoria} ${l.pagamento}`.toLowerCase().includes(termo)));

  if (!itens.length) { $("lista").innerHTML = `<div class="vazio">Nada encontrado.</div>`; return; }

  const dias = {};
  itens.forEach((l) => (dias[l.data] = dias[l.data] || []).push(l));
  $("lista").innerHTML = Object.keys(dias).sort().reverse().map((dia) => {
    const saldoDia = dias[dia].reduce((s, l) => s + (l.tipo === "gasto" ? -l.valor : l.valor), 0);
    return `<div class="dia"><span>${nomeDia(dia)}</span><span>${reais(saldoDia)}</span></div>
      <div class="grupo">${dias[dia].map(htmlItem).join("")}</div>`;
  }).join("");
}

// ---------------------------------------------------------------- formulário
function desenharCategorias() {
  $("categorias").innerHTML = CATEGORIAS[tipoForm].map(([n, e]) =>
    `<button type="button" data-cat="${n}" class="${n === catForm ? "ativo" : ""}"><span>${e}</span>${n}</button>`).join("");
}
function escolherTipo(tipo) {
  tipoForm = tipo;
  document.querySelectorAll(".tipo button").forEach((b) => b.classList.toggle("ativo", b.dataset.tipo === tipo));
  if (!CATEGORIAS[tipo].some(([n]) => n === catForm)) catForm = null;
  desenharCategorias();
}

function abrirForm(lanc) {
  editandoId = lanc ? lanc.id : null;
  catForm = lanc ? lanc.categoria : null;
  escolherTipo(lanc ? lanc.tipo : "gasto");
  $("valor").value = lanc ? valorParaTexto(lanc.valor) : "";
  $("descricao").value = lanc ? lanc.descricao : "";
  // Se estiver vendo outro mês, já sugere uma data dentro dele
  $("data").value = lanc ? lanc.data : (mesAtual === hojeISO().slice(0, 7) ? hojeISO() : mesAtual + "-01");
  $("pagamento").value = lanc ? lanc.pagamento : "Pix";
  $("excluir").hidden = !lanc;
  $("salvar").textContent = lanc ? "Salvar alterações" : "Salvar";
  $("gaveta").classList.add("aberta");
  $("fundo").classList.add("aberto");
  if (!lanc) setTimeout(() => $("valor").focus(), 250);
}
function fecharForm() {
  $("gaveta").classList.remove("aberta");
  $("fundo").classList.remove("aberto");
  document.activeElement && document.activeElement.blur();
}

$("gaveta").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const valor = lerValor($("valor").value);
  if (!(valor > 0)) { avisar("Digite um valor maior que zero"); $("valor").focus(); return; }
  if (!catForm) { avisar("Escolha uma categoria"); return; }
  if (!$("data").value) { avisar("Escolha a data"); return; }

  const novo = {
    tipo: tipoForm,
    valor,
    categoria: catForm,
    descricao: $("descricao").value.trim(),
    data: $("data").value,
    pagamento: $("pagamento").value,
  };
  if (editandoId) {
    const i = dados.lancamentos.findIndex((l) => l.id === editandoId);
    if (i >= 0) dados.lancamentos[i] = { ...dados.lancamentos[i], ...novo };
    avisar("Alterado ✔");
  } else {
    novo.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    novo.criado = new Date().toISOString();
    dados.lancamentos.push(novo);
    avisar(tipoForm === "gasto" ? "Gasto salvo ✔" : "Entrada salva ✔");
  }
  salvarDados();
  mesAtual = novo.data.slice(0, 7);
  fecharForm();
  desenhar();
});

$("excluir").addEventListener("click", () => {
  if (!editandoId || !confirm("Excluir este lançamento?")) return;
  dados.lancamentos = dados.lancamentos.filter((l) => l.id !== editandoId);
  salvarDados();
  fecharForm();
  desenhar();
  avisar("Excluído");
});

$("categorias").addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  catForm = b.dataset.cat;
  desenharCategorias();
});
document.querySelectorAll(".tipo button").forEach((b) => b.addEventListener("click", () => escolherTipo(b.dataset.tipo)));
$("botaoMais").addEventListener("click", () => abrirForm(null));
$("fundo").addEventListener("click", fecharForm);

// Tocar num lançamento abre para editar
document.addEventListener("click", (ev) => {
  const item = ev.target.closest(".item");
  if (!item) return;
  const l = dados.lancamentos.find((x) => x.id === item.dataset.id);
  if (l) abrirForm(l);
});

// ---------------------------------------------------------------- navegação
document.querySelectorAll(".menu button").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll(".menu button").forEach((x) => x.classList.toggle("ativo", x === b));
  document.querySelectorAll(".aba").forEach((a) => a.classList.toggle("ativa", a.id === "aba-" + b.dataset.aba));
  $("botaoMais").hidden = b.dataset.aba === "ajustes";
  window.scrollTo(0, 0);
}));
$("mesAnterior").addEventListener("click", () => mudarMes(-1));
$("mesSeguinte").addEventListener("click", () => mudarMes(1));
$("busca").addEventListener("input", () => desenharLista(doMes()));
$("filtros").addEventListener("click", (ev) => {
  const b = ev.target.closest(".chip");
  if (!b) return;
  filtroCat = b.dataset.cat;
  desenharLista(doMes());
});

// ---------------------------------------------------------------- ajustes
$("orcInput").value = dados.orcamento ? valorParaTexto(dados.orcamento) : "";
$("salvarOrc").addEventListener("click", () => {
  const v = $("orcInput").value.trim() ? lerValor($("orcInput").value) : 0;
  if (!(v >= 0)) { avisar("Valor inválido"); return; }
  dados.orcamento = v;
  salvarDados();
  desenhar();
  avisar(v ? "Limite salvo ✔" : "Limite desligado");
});

async function baixar(nome, conteudo, tipo) {
  const arquivo = new File([conteudo], nome, { type: tipo });
  // No iPhone, abre o menu de compartilhar (Salvar em Arquivos, WhatsApp, e-mail...)
  if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
    try { await navigator.share({ files: [arquivo], title: nome }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(arquivo);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

$("exportarJson").addEventListener("click", () =>
  baixar(`backup-gastos-${hojeISO()}.json`, JSON.stringify(dados, null, 2), "application/json"));

$("exportarCsv").addEventListener("click", () => {
  const linhas = [["Data", "Tipo", "Categoria", "Descrição", "Pagamento", "Valor"]];
  [...dados.lancamentos].sort((a, b) => a.data.localeCompare(b.data)).forEach((l) => linhas.push([
    l.data.split("-").reverse().join("/"), l.tipo === "gasto" ? "Gasto" : "Entrada",
    l.categoria, l.descricao, l.pagamento,
    (l.tipo === "gasto" ? "-" : "") + valorParaTexto(l.valor),
  ]));
  // ";" e BOM para o Excel em português abrir certinho
  const csv = "﻿" + linhas.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  baixar(`gastos-${hojeISO()}.csv`, csv, "text/csv");
});

$("importarJson").addEventListener("click", () => $("arquivoImport").click());
$("arquivoImport").addEventListener("change", async (ev) => {
  const arq = ev.target.files[0];
  ev.target.value = "";
  if (!arq) return;
  try {
    const novo = JSON.parse(await arq.text());
    if (!novo || !Array.isArray(novo.lancamentos)) throw new Error("formato");
    const ok = novo.lancamentos.every((l) => l.id && l.data && (l.tipo === "gasto" || l.tipo === "entrada") && Number.isInteger(l.valor));
    if (!ok) throw new Error("formato");
    if (!confirm(`Restaurar ${novo.lancamentos.length} lançamentos? Isso substitui o que está no app agora.`)) return;
    dados = { orcamento: 0, ...novo };
    salvarDados();
    $("orcInput").value = dados.orcamento ? valorParaTexto(dados.orcamento) : "";
    desenhar();
    avisar("Backup restaurado ✔");
  } catch (e) {
    avisar("Esse arquivo não é um backup válido");
  }
});

$("apagarTudo").addEventListener("click", () => {
  if (!confirm("Apagar TODOS os gastos e entradas? Não dá para desfazer.")) return;
  if (!confirm("Tem certeza mesmo? Faça um backup antes se quiser guardar.")) return;
  dados = { lancamentos: [], orcamento: 0 };
  salvarDados();
  $("orcInput").value = "";
  desenhar();
  avisar("Tudo apagado");
});

// ---------------------------------------------------------------- iniciar
desenhar();
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

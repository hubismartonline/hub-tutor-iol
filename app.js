// =============================================================
//  Hub do Tutor — app.js
//  Troque a URL abaixo pela URL do seu TUTOR_AUTH_SCRIPT publicado.
// =============================================================
const TUTOR_AUTH_URL = "https://script.google.com/macros/s/AKfycbwngsYR01zkmC3fCfYmomOBSgcwwmi_xCC-vuCKumHXRMoWsI_XyI_iY9rfMs1eJN5OAA/exec";

let sessao = { email: "", token: "" };

// -------------------------------------------------------
//  Navegação entre etapas do login
// -------------------------------------------------------
function irParaEtapa(nome) {
  document.querySelectorAll('#view-login > .login-card > div[id^="etapa-"]').forEach(el => el.style.display = "none");
  document.getElementById("etapa-" + nome).style.display = "block";
}

function mostrarErro(idErro, mensagem) {
  const el = document.getElementById(idErro);
  el.textContent = mensagem;
  el.style.display = "block";
}
function esconderErro(idErro) {
  document.getElementById(idErro).style.display = "none";
}

async function chamarBackend(acao, dados) {
  const resp = await fetch(TUTOR_AUTH_URL, {
    method: "POST",
    body: JSON.stringify({ acao, ...dados })
  });
  return resp.json();
}

// -------------------------------------------------------
//  LOGIN NORMAL
// -------------------------------------------------------
async function fazerLogin() {
  esconderErro("login-erro");
  const email = document.getElementById("login-email").value.trim();
  const senha = document.getElementById("login-senha").value;
  if (!email || !senha) { mostrarErro("login-erro", "Preencha e-mail e senha."); return; }

  const btn = document.getElementById("btn-login");
  btn.disabled = true; btn.textContent = "Entrando...";
  try {
    const r = await chamarBackend("login", { email, senha });
    if (!r.ok) { mostrarErro("login-erro", "E-mail ou senha incorretos."); return; }
    entrarNoApp(email, r);
  } catch (e) {
    mostrarErro("login-erro", "Não foi possível conectar. Tente novamente.");
  } finally {
    btn.disabled = false; btn.textContent = "Entrar";
  }
}

// -------------------------------------------------------
//  PRIMEIRO ACESSO
// -------------------------------------------------------
let emailPrimeiroAcesso = "";

async function solicitarCodigoPrimeiroAcesso() {
  esconderErro("pa-erro");
  const email = document.getElementById("pa-email").value.trim();
  if (!email) { mostrarErro("pa-erro", "Digite seu e-mail."); return; }
  try {
    const r = await chamarBackend("solicitar_codigo", { email });
    if (!r.ok) { mostrarErro("pa-erro", r.erro || "Não foi possível autenticar."); return; }
    emailPrimeiroAcesso = email;
    document.getElementById("pa-email-mascarado-txt").textContent =
      `Enviamos um código para ${r.email_mascarado}. Confira sua caixa de entrada (e o spam).`;
    irParaEtapa("criar-senha");
  } catch (e) {
    mostrarErro("pa-erro", "Não foi possível conectar. Tente novamente.");
  }
}

async function confirmarECriarSenha() {
  esconderErro("cs-erro");
  const codigo = document.getElementById("pa-codigo").value.trim();
  const senha = document.getElementById("pa-senha").value;
  if (!codigo || !senha) { mostrarErro("cs-erro", "Preencha o código e a senha."); return; }
  if (senha.length < 6) { mostrarErro("cs-erro", "A senha precisa ter pelo menos 6 caracteres."); return; }

  try {
    const rv = await chamarBackend("verificar_codigo", { email: emailPrimeiroAcesso, codigo, tipo: "primeiro_acesso" });
    if (!rv.ok) { mostrarErro("cs-erro", rv.erro || "Código incorreto."); return; }

    const rc = await chamarBackend("criar_senha", { email: emailPrimeiroAcesso, senha });
    if (!rc.ok) { mostrarErro("cs-erro", rc.erro || "Não foi possível criar a senha."); return; }

    entrarNoApp(emailPrimeiroAcesso, rc);
  } catch (e) {
    mostrarErro("cs-erro", "Não foi possível conectar. Tente novamente.");
  }
}

// -------------------------------------------------------
//  ESQUECI MINHA SENHA
// -------------------------------------------------------
let emailRecuperacao = "";

async function solicitarRecuperacao() {
  esconderErro("es-erro");
  const email = document.getElementById("es-email").value.trim();
  if (!email) { mostrarErro("es-erro", "Digite seu e-mail."); return; }
  try {
    const r = await chamarBackend("solicitar_recuperacao", { email });
    if (!r.ok) { mostrarErro("es-erro", r.erro || "Não foi possível autenticar."); return; }
    emailRecuperacao = email;
    document.getElementById("es-email-mascarado-txt").textContent =
      `Enviamos um código para ${r.email_mascarado}. Confira sua caixa de entrada (e o spam).`;
    irParaEtapa("redefinir-senha");
  } catch (e) {
    mostrarErro("es-erro", "Não foi possível conectar. Tente novamente.");
  }
}

async function confirmarERedefinirSenha() {
  esconderErro("rs-erro");
  const codigo = document.getElementById("rs-codigo").value.trim();
  const senhaNova = document.getElementById("rs-senha").value;
  if (!codigo || !senhaNova) { mostrarErro("rs-erro", "Preencha o código e a nova senha."); return; }
  if (senhaNova.length < 6) { mostrarErro("rs-erro", "A senha precisa ter pelo menos 6 caracteres."); return; }

  try {
    const rv = await chamarBackend("verificar_codigo", { email: emailRecuperacao, codigo, tipo: "recuperacao" });
    if (!rv.ok) { mostrarErro("rs-erro", rv.erro || "Código incorreto."); return; }

    const rr = await chamarBackend("redefinir_senha", { email: emailRecuperacao, senha_nova: senhaNova });
    if (!rr.ok) { mostrarErro("rs-erro", rr.erro || "Não foi possível redefinir a senha."); return; }

    // redefinir_senha não devolve token — pede login normal em seguida
    irParaEtapa("login");
    document.getElementById("login-email").value = emailRecuperacao;
    esconderErro("login-erro");
  } catch (e) {
    mostrarErro("rs-erro", "Não foi possível conectar. Tente novamente.");
  }
}

// -------------------------------------------------------
//  ENTRAR NO APP (depois de login OU criação de senha)
// -------------------------------------------------------
function entrarNoApp(email, dados) {
  sessao.email = email;
  sessao.token = dados.token_tutor;

  document.getElementById("tutor-nome").textContent = dados.nome || email;
  const serieTxt = dados.serie_responsavel || "—";
  const pracaTxt = Array.isArray(dados.praca_responsavel) ? dados.praca_responsavel.join(", ") : "—";
  document.getElementById("tutor-meta").textContent = `${serieTxt} · ${pracaTxt}`;

  document.getElementById("view-login").style.display = "none";
  document.getElementById("view-app").style.display = "block";

  carregarMeusAlunos();
}

function sair() {
  sessao = { email: "", token: "" };
  document.getElementById("view-app").style.display = "none";
  document.getElementById("view-login").style.display = "flex";
  irParaEtapa("login");
  document.getElementById("login-senha").value = "";
}

// -------------------------------------------------------
//  MEUS ALUNOS
// -------------------------------------------------------
function irPara(pagina) {
  document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));
  const clicado = document.querySelector(`.nav-item[data-page="${pagina}"]`);
  if (clicado) clicado.classList.add("active");
  document.querySelectorAll(".page").forEach(el => el.style.display = "none");
  const pageEl = document.getElementById("page-" + pagina);
  if (pageEl) pageEl.style.display = "block";
}

async function carregarMeusAlunos() {
  const loading = document.getElementById("alunos-loading");
  const vazio = document.getElementById("alunos-vazio");
  const tabela = document.getElementById("alunos-tabela");
  const tbody = document.getElementById("alunos-tbody");

  loading.style.display = "block";
  vazio.style.display = "none";
  tabela.style.display = "none";

  try {
    const r = await chamarBackend("listar_meus_alunos", { email: sessao.email, token_tutor: sessao.token });
    loading.style.display = "none";
    if (!r.ok) { vazio.textContent = r.erro || "Não foi possível carregar seus alunos."; vazio.style.display = "block"; return; }
    if (!r.alunos || r.alunos.length === 0) { vazio.style.display = "block"; return; }

    tbody.innerHTML = r.alunos.map(a => `
      <tr>
        <td>${a.ra}</td>
        <td>${a.nome}</td>
        <td>${a.serie}</td>
        <td>${a.cidade}</td>
      </tr>
    `).join("");
    tabela.style.display = "table";
  } catch (e) {
    loading.style.display = "none";
    vazio.textContent = "Não foi possível conectar. Tente novamente.";
    vazio.style.display = "block";
  }
}

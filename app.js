// =============================================================
//  Hub do Tutor — app.js
//  Troque a URL abaixo pela URL do seu TUTOR_AUTH_SCRIPT publicado.
// =============================================================
const TUTOR_AUTH_URL = "https://script.google.com/macros/s/AKfycbzKIgfp4gWuxZcMUL_P4U1pUdLhctyguVRjSJcPzvI5sYJG9M4Dn53Qn15528r-DLV4hw/exec";

let sessao = { email: "", token: "", tipo: "" };

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

function chamarBackend(acao, dados) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", TUTOR_AUTH_URL, true);
    xhr.setRequestHeader("Content-Type", "text/plain;charset=utf-8");
    xhr.onload = function () {
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch (e) {
        reject(new Error("Resposta inválida do servidor."));
      }
    };
    xhr.onerror = function () {
      reject(new Error("Falha de rede."));
    };
    xhr.send(JSON.stringify({ acao, ...dados }));
  });
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
  sessao.tipo = dados.tipo || "tutor";

  document.getElementById("tutor-nome").textContent = dados.nome || email;
  const serieTxt = dados.serie_responsavel || "—";
  const pracaTxt = Array.isArray(dados.praca_responsavel) ? dados.praca_responsavel.join(", ") : "—";
  document.getElementById("tutor-meta").textContent = `${serieTxt} · ${pracaTxt}`;

  document.getElementById("view-login").style.display = "none";
  document.getElementById("view-app").style.display = "block";

  // Prestação de contas e Meus Alunos são só do tutor por enquanto —
  // coordenação não tem alunos alocados nem envia horas. A aprovação
  // da coordenação ainda vai entrar com o Painel de coordenação.
  const navContas = document.querySelector('.nav-item[data-page="contas"]');
  if (navContas) navContas.style.display = sessao.tipo === "tutor" ? "" : "none";
  const navDashboard = document.querySelector('.nav-item[data-page="dashboard"]');
  if (navDashboard) navDashboard.style.display = "";
  const navAlunos = document.querySelector('.nav-item[data-page="alunos"]');

  if (sessao.tipo === "coordenacao") {
    if (navAlunos) navAlunos.style.display = "none";
    irPara("prontuario");
  } else {
    carregarMeusAlunos();
  }
}

function sair() {
  sessao = { email: "", token: "", tipo: "" };
  document.getElementById("view-app").style.display = "none";
  document.getElementById("view-login").style.display = "flex";
  irParaEtapa("login");
  document.getElementById("login-senha").value = "";

  // Limpa o estado de "Meus Alunos" pra não vazar dados do tutor
  // anterior entre sessões (mesmo padrão do Hub do Aluno).
  document.getElementById("alunos-tbody").innerHTML = "";
  document.getElementById("alunos-tabela").style.display = "none";
  document.getElementById("alunos-vazio").style.display = "none";
  document.getElementById("alunos-loading").style.display = "block";

  // Idem pro Prontuário — nome, timeline e formulário do aluno anterior
  // não podem persistir no DOM entre sessões diferentes.
  prontuarioAlunoAtualRA = "";
  document.getElementById("prontuario-alunos-lista").innerHTML = "";
  document.getElementById("prontuario-busca-input").value = "";
  document.getElementById("prontuario-busca-resultado").innerHTML = "";
  document.getElementById("prontuario-detail").innerHTML = '<p class="hint">Selecione um aluno para ver o prontuário.</p>';
  document.getElementById("prontuario-lista-tutor").style.display = "none";
  document.getElementById("prontuario-busca-coordenacao").style.display = "none";

  // Idem pra Prestação de Contas — linhas de serviço, totais e histórico
  // do tutor anterior não podem persistir entre sessões diferentes.
  contasCalendario = [];
  contasValorHora = 0;
  document.getElementById("contas-linhas").innerHTML = "";
  document.getElementById("contas-semana").innerHTML = "";
  document.getElementById("contas-outros").value = "";
  document.getElementById("contas-nf-box").style.display = "none";
  document.getElementById("contas-historico-tbody").innerHTML = "";
  document.getElementById("contas-historico-tabela").style.display = "none";

  // Idem pro Dashboard da turma.
  document.getElementById("dashboard-conteudo").style.display = "none";
  document.getElementById("dashboard-loading").style.display = "block";
  document.getElementById("dashboard-loading").textContent = "Carregando...";
  document.getElementById("dash-sem-retorno-lista").innerHTML = "";
  document.getElementById("dash-sem-retorno-card").style.display = "none";

  // Idem pra Estratégias de Vestibular (dado de outra pessoa não pode
  // persistir no DOM entre sessões diferentes).
  dashVestData = null;
  document.getElementById("dash-vest-preenchimento").innerHTML = "";
  document.getElementById("dash-vest-posicao").innerHTML = "";
  document.getElementById("dash-vest-chips-posicao").innerHTML = "";
  document.getElementById("dash-vest-quadrantes").innerHTML = "";
  document.getElementById("dash-vest-nota-total-hint").textContent = "";
  document.getElementById("dash-vest-tabela-tutores").innerHTML = "";
  document.getElementById("dash-vest-privadas").innerHTML = "";
  document.getElementById("dash-vest-drill").style.display = "none";
  document.getElementById("dash-vest-drill-tabela").innerHTML = "";
  document.getElementById("dash-vest-drill-lista").innerHTML = "";
  document.getElementById("dash-vest-praca").value = "";
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

  if (pagina === "prontuario") iniciarProntuario();
  if (pagina === "contas") iniciarPrestacaoContas();
  if (pagina === "dashboard") iniciarDashboardTurma();
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
        <td>${a.praca}</td>
      </tr>
    `).join("");
    tabela.style.display = "table";
  } catch (e) {
    loading.style.display = "none";
    vazio.textContent = "Não foi possível conectar. Tente novamente.";
    vazio.style.display = "block";
  }
}

// =============================================================
//  PRONTUÁRIO DO ALUNO
// =============================================================

// Situações e campos dinâmicos — mesma definição do protótipo da Larissa.
// Fica só no front porque o backend guarda "campos" como um blob genérico
// (chave: valor); é aqui que a gente decide o que cada chave significa e
// como mostrar na timeline.
const SITUACOES = [
  { id: "familia", label: "Questões familiares/pessoais", campos: [
    { key: "retorno", label: "Entrou em contato com o(s) responsável(is)? Qual foi o retorno?", tipo: "textarea" } ] },
  { id: "dificuldade", label: "Dificuldade acadêmica ou de organização", campos: [
    { key: "plano", label: "Qual o plano de ação?", tipo: "textarea" } ] },
  { id: "tecnico", label: "Problema técnico", campos: [
    { key: "plataforma", label: "Qual plataforma/sistema apresentou o problema?", tipo: "text" },
    { key: "encaminhado", label: "Foi encaminhado para o formulário de suporte?", tipo: "select", opcoes: ["Sim", "Não"] } ] },
  { id: "desmotivacao", label: "Desmotivação", campos: [
    { key: "motivoAluno", label: "O aluno verbalizou algum motivo?", tipo: "textarea" },
    { key: "retornoResp", label: "Qual foi o retorno dos responsáveis?", tipo: "textarea" } ] },
  { id: "rotina", label: "Contato de rotina / check-in", campos: [
    { key: "descricao", label: "Descrição", tipo: "textarea" } ] },
];

let prontuarioAlunoAtualRA = "";
let prontuarioAlunoAtualNome = "";

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function formatarDataISO(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// -------------------------------------------------------
//  ENTRADA NA PÁGINA — decide UI por tipo (tutor vs coordenação)
// -------------------------------------------------------
function iniciarProntuario() {
  const listaTutor = document.getElementById("prontuario-lista-tutor");
  const buscaCoord = document.getElementById("prontuario-busca-coordenacao");

  if (sessao.tipo === "coordenacao") {
    listaTutor.style.display = "none";
    buscaCoord.style.display = "block";
  } else {
    buscaCoord.style.display = "none";
    listaTutor.style.display = "block";
    carregarAlunosProntuarioTutor();
  }
}

// -------------------------------------------------------
//  TUTOR: lista os alunos alocados (mesma fonte do "Meus Alunos")
// -------------------------------------------------------
async function carregarAlunosProntuarioTutor() {
  const loading = document.getElementById("prontuario-alunos-loading");
  const lista   = document.getElementById("prontuario-alunos-lista");
  loading.style.display = "block";
  lista.innerHTML = "";
  try {
    const r = await chamarBackend("listar_meus_alunos", { email: sessao.email, token_tutor: sessao.token });
    loading.style.display = "none";
    if (!r.ok || !r.alunos || r.alunos.length === 0) {
      lista.innerHTML = '<p class="hint">Nenhum aluno encontrado.</p>';
      return;
    }
    renderListaAlunosProntuario(r.alunos, "prontuario-alunos-lista");
  } catch (e) {
    loading.style.display = "none";
    lista.innerHTML = '<p class="hint">Não foi possível carregar seus alunos.</p>';
  }
}

// -------------------------------------------------------
//  COORDENAÇÃO: busca por nome ou RA
// -------------------------------------------------------
async function buscarAlunosProntuarioCoordenacao() {
  const termo = document.getElementById("prontuario-busca-input").value.trim();
  const resultado = document.getElementById("prontuario-busca-resultado");
  if (!termo) { resultado.innerHTML = '<p class="hint">Digite um nome ou RA.</p>'; return; }
  resultado.innerHTML = '<p class="hint">Buscando...</p>';
  try {
    const r = await chamarBackend("buscar_alunos_prontuario", { email: sessao.email, token_tutor: sessao.token, termo });
    if (!r.ok) { resultado.innerHTML = `<p class="hint">${escapeHtml(r.erro || "Não foi possível buscar.")}</p>`; return; }
    if (!r.alunos || r.alunos.length === 0) { resultado.innerHTML = '<p class="hint">Nenhum aluno encontrado.</p>'; return; }
    renderListaAlunosProntuario(r.alunos, "prontuario-busca-resultado");
  } catch (e) {
    resultado.innerHTML = '<p class="hint">Não foi possível conectar. Tente novamente.</p>';
  }
}

// -------------------------------------------------------
//  Lista clicável de alunos (usada tanto pelo tutor quanto pela
//  busca da coordenação)
// -------------------------------------------------------
function renderListaAlunosProntuario(alunos, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = alunos.map(a => `
    <div class="aluno-item ${a.ra === prontuarioAlunoAtualRA ? "active" : ""}" onclick="selecionarAlunoProntuario('${a.ra}')">
      <div class="nome">${escapeHtml(a.nome)}</div>
      <div class="sub">${escapeHtml(a.serie || "")}${a.praca ? " · " + escapeHtml(a.praca) : ""}${a.tutor ? " · " + escapeHtml(a.tutor) : ""}</div>
    </div>
  `).join("");
}

// -------------------------------------------------------
//  Seleciona um aluno e carrega o prontuário dele
// -------------------------------------------------------
async function selecionarAlunoProntuario(ra) {
  prontuarioAlunoAtualRA = ra;
  const det = document.getElementById("prontuario-detail");
  det.innerHTML = '<p class="hint">Carregando prontuário...</p>';

  document.querySelectorAll(".aluno-item").forEach(el => {
    el.classList.toggle("active", el.getAttribute("onclick") === `selecionarAlunoProntuario('${ra}')`);
  });

  try {
    const r = await chamarBackend("buscar_prontuario", { email: sessao.email, token_tutor: sessao.token, aluno_ra: ra });
    if (!r.ok) { det.innerHTML = `<p class="hint">${escapeHtml(r.erro || "Não foi possível carregar o prontuário.")}</p>`; return; }
    prontuarioAlunoAtualNome = r.aluno.nome;
    renderProntuarioDetail(r);
  } catch (e) {
    det.innerHTML = '<p class="hint">Não foi possível conectar. Tente novamente.</p>';
  }
}

// -------------------------------------------------------
//  Monta o painel de detalhe: dados do aluno, destaque, formulário
//  de novo contato (só tutor), ressalva (só tutor) e timeline.
// -------------------------------------------------------
function renderProntuarioDetail(data) {
  const aluno = data.aluno;
  const destaque = data.destaque;
  const souTutor = sessao.tipo === "tutor";
  const det = document.getElementById("prontuario-detail");

  det.innerHTML = `
    <div class="prontuario-aluno-header">
      <h2>${escapeHtml(aluno.nome)}</h2>
      <p class="hint">${escapeHtml(aluno.serie)} · ${escapeHtml(aluno.praca)} · Tutor(a): ${escapeHtml(aluno.tutor)}</p>
    </div>

    <div class="destaque-aluno-row">
      ${destaque.ativo
        ? `<span class="badge">⭐ Aluno destaque</span>${souTutor ? `<button class="btn ghost small" onclick="toggleDestaqueAlunoForm()">Editar justificativa</button>` : ""}`
        : (souTutor ? `<button class="btn ghost small" onclick="toggleDestaqueAlunoForm()">⭐ Marcar aluno como destaque</button>` : "")}
    </div>
    <div id="destaque-aluno-form" style="display:none; margin-bottom:16px">
      <label>Por que este aluno é um destaque?</label>
      <textarea id="destaque-aluno-justificativa" rows="2" placeholder="Ex.: conquista, superação, reversão de uma situação anterior">${escapeHtml(destaque.justificativa || "")}</textarea>
      <button class="btn small" style="margin-top:6px" onclick="salvarDestaqueAlunoUI()">Salvar</button>
    </div>

    ${souTutor ? `
      <div style="border-top:1px solid var(--border); padding-top:16px; margin-top:4px">
        <label style="margin-top:0">Qual foco motivou este contato? (opcional)</label>
        <input id="registro-foco" type="text" placeholder="Ex.: pendência de matrícula, acompanhamento de notas...">

        <label>Qual a situação do aluno?</label>
        <select id="nova-situacao" onchange="renderCamposSituacao()">
          ${SITUACOES.map(s => `<option value="${s.id}">${s.label}</option>`).join("")}
        </select>
        <div id="situacao-fields"></div>

        <label>Qual foi o combinado? (opcional)</label>
        <textarea id="registro-combinado" rows="2" placeholder="Descreva o combinado feito com o aluno, se houver"></textarea>
        <label>Prazo de retorno (opcional)</label>
        <input id="registro-prazo-retorno" type="date">

        <div class="destaque-checkbox-row">
          <input type="checkbox" id="marcar-destaque" onchange="document.getElementById('destaque-justificativa-wrap').style.display = this.checked ? 'block' : 'none'">
          <label for="marcar-destaque">Marcar este registro como Destaque</label>
        </div>
        <div id="destaque-justificativa-wrap" style="display:none; margin-top:8px">
          <label style="margin-top:0">Por que este registro é um destaque?</label>
          <textarea id="destaque-registro-justificativa" rows="2" placeholder="Justifique o destaque"></textarea>
        </div>

        <button class="btn" style="margin-top:14px" onclick="salvarRegistroContato()">Salvar no prontuário</button>

        <div class="ressalva-box">
          <h3>⚖️ Registrar uma ressalva</h3>
          <p class="hint" style="margin:0 0 10px">Use pra registrar uma defesa ou justificativa importante — por exemplo, antes de uma decisão de desligamento.</p>
          <textarea id="ressalva-texto" rows="3" placeholder="Descreva a ressalva/justificativa"></textarea>
          <button class="btn secondary" style="margin-top:10px" onclick="salvarRessalva()">Registrar ressalva</button>
        </div>
      </div>
    ` : ""}

    <div style="margin-top:26px; padding-top:18px; border-top:1px solid var(--border)">
      <label style="margin-top:0">Linha do tempo de contatos</label>
      <div class="timeline-list">${timelineHTML(data.registros)}</div>
    </div>
  `;

  if (souTutor) renderCamposSituacao();
}

// -------------------------------------------------------
//  Campos dinâmicos por situação
// -------------------------------------------------------
function renderCamposSituacao() {
  const situacaoId = document.getElementById("nova-situacao").value;
  const situacao = SITUACOES.find(s => s.id === situacaoId);
  const wrap = document.getElementById("situacao-fields");
  if (!situacao) { wrap.innerHTML = ""; return; }
  wrap.innerHTML = situacao.campos.map(c => {
    if (c.tipo === "textarea") return `<label>${escapeHtml(c.label)}</label><textarea rows="2" data-key="${c.key}"></textarea>`;
    if (c.tipo === "select") return `<label>${escapeHtml(c.label)}</label><select data-key="${c.key}">${c.opcoes.map(o => `<option>${escapeHtml(o)}</option>`).join("")}</select>`;
    return `<label>${escapeHtml(c.label)}</label><input type="text" data-key="${c.key}">`;
  }).join("");
}

// -------------------------------------------------------
//  Salvar novo registro de contato
// -------------------------------------------------------
async function salvarRegistroContato() {
  const situacaoId = document.getElementById("nova-situacao").value;
  const situacao = SITUACOES.find(s => s.id === situacaoId);
  const campos = {};
  situacao.campos.forEach(c => {
    const el = document.querySelector(`#situacao-fields [data-key="${c.key}"]`);
    if (el && el.value.trim()) campos[c.key] = el.value.trim();
  });

  const combinado = document.getElementById("registro-combinado").value.trim();
  const marcarDestaque = document.getElementById("marcar-destaque").checked;

  if (Object.keys(campos).length === 0 && !combinado) {
    alert("Preencha ao menos um campo antes de salvar.");
    return;
  }

  const dados = {
    email: sessao.email,
    token_tutor: sessao.token,
    aluno_ra: prontuarioAlunoAtualRA,
    foco_texto: document.getElementById("registro-foco").value.trim(),
    situacao_id: situacaoId,
    situacao_label: situacao.label,
    campos: campos,
    combinado: combinado,
    prazo_retorno: document.getElementById("registro-prazo-retorno").value,
    destaque: marcarDestaque,
    destaque_justificativa: marcarDestaque ? document.getElementById("destaque-registro-justificativa").value.trim() : "",
  };

  try {
    const r = await chamarBackend("registrar_contato_prontuario", dados);
    if (!r.ok) { alert(r.erro || "Não foi possível salvar o registro."); return; }
    await selecionarAlunoProntuario(prontuarioAlunoAtualRA); // recarrega com o novo registro na timeline
  } catch (e) {
    alert("Não foi possível conectar. Tente novamente.");
  }
}

// -------------------------------------------------------
//  Salvar ressalva
// -------------------------------------------------------
async function salvarRessalva() {
  const texto = document.getElementById("ressalva-texto").value.trim();
  if (!texto) { alert("Descreva a ressalva antes de registrar."); return; }
  try {
    const r = await chamarBackend("registrar_ressalva_prontuario", {
      email: sessao.email, token_tutor: sessao.token, aluno_ra: prontuarioAlunoAtualRA, texto
    });
    if (!r.ok) { alert(r.erro || "Não foi possível registrar a ressalva."); return; }
    await selecionarAlunoProntuario(prontuarioAlunoAtualRA);
  } catch (e) {
    alert("Não foi possível conectar. Tente novamente.");
  }
}

// -------------------------------------------------------
//  Destaque do aluno (selo no nível do aluno, separado do destaque
//  por registro)
// -------------------------------------------------------
function toggleDestaqueAlunoForm() {
  const form = document.getElementById("destaque-aluno-form");
  form.style.display = form.style.display === "none" ? "block" : "none";
}

async function salvarDestaqueAlunoUI() {
  const justificativa = document.getElementById("destaque-aluno-justificativa").value.trim();
  if (!justificativa) { alert("Justifique por que este aluno é um destaque."); return; }
  try {
    const r = await chamarBackend("marcar_destaque_aluno", {
      email: sessao.email, token_tutor: sessao.token, aluno_ra: prontuarioAlunoAtualRA,
      ativo: true, justificativa
    });
    if (!r.ok) { alert(r.erro || "Não foi possível salvar."); return; }
    await selecionarAlunoProntuario(prontuarioAlunoAtualRA);
  } catch (e) {
    alert("Não foi possível conectar. Tente novamente.");
  }
}

// -------------------------------------------------------
//  Timeline — reconstrói o texto de cada registro a partir dos
//  "campos" salvos + as labels do SITUACOES (o backend só guarda
//  chave:valor; quem sabe o rótulo de cada chave é o front).
// -------------------------------------------------------
function timelineHTML(registros) {
  if (!registros || registros.length === 0) return '<p class="hint">Nenhum registro ainda.</p>';

  return registros.map(reg => {
    if (reg.tipo === "ressalva") {
      return `
        <div class="timeline-item ressalva">
          <div class="timeline-date">${formatarDataISO(reg.criado_em)}
            <span class="timeline-tag ressalva">Ressalva</span>
          </div>
          <div class="timeline-texto">${escapeHtml(reg.texto_ressalva)}<br><span class="hint">— ${escapeHtml(reg.tutor_nome)}</span></div>
        </div>`;
    }

    const situacao = SITUACOES.find(s => s.id === reg.situacao_id);
    const linhas = situacao
      ? situacao.campos
          .map(c => (reg.campos && reg.campos[c.key]) ? c.label.replace(/\?$/, "") + ": " + reg.campos[c.key] : null)
          .filter(Boolean)
      : [];
    let texto = linhas.join("\n");
    if (reg.combinado) {
      texto += (texto ? "\n" : "") + "Combinado: " + reg.combinado;
      if (reg.prazo_retorno) texto += " (retorno até " + formatarDataISO(reg.prazo_retorno) + ")";
    }

    return `
      <div class="timeline-item">
        <div class="timeline-date">${formatarDataISO(reg.criado_em)}
          ${reg.foco_texto ? `<span class="timeline-tag">${escapeHtml(reg.foco_texto)}</span>` : ""}
          <span class="timeline-tag">${escapeHtml(reg.situacao_label || "")}</span>
          ${reg.destaque ? `<span class="timeline-tag destaque">Destaque${reg.destaque_justificativa ? ": " + escapeHtml(reg.destaque_justificativa) : ""}</span>` : ""}
        </div>
        <div class="timeline-texto">${escapeHtml(texto)}<br><span class="hint">— ${escapeHtml(reg.tutor_nome)}</span></div>
      </div>`;
  }).join("");
}

// =============================================================
//  PRESTAÇÃO DE CONTAS / NF
// =============================================================
let contasCalendario = [];     // ciclos vindos de buscar_calendario_horas
let contasValorHora = 0;
let contasLinhaSeq = 0;
let TIPOS_SERVICO_CONTAS = []; // vem do backend (mesma lista usada pra validar no envio)
let mapaSemanaCiclo = {};       // semana -> { periodo_emissao, ultima }

function formatarMinutos(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return h + ":" + String(m).padStart(2, "0");
}
function formatarMoeda(v) {
  return "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// -------------------------------------------------------
//  Entrada na página
// -------------------------------------------------------
async function iniciarPrestacaoContas() {
  document.getElementById("contas-linhas").innerHTML = "";
  document.getElementById("contas-semana").innerHTML = "<option>Carregando...</option>";
  try {
    const r = await chamarBackend("buscar_calendario_horas", { email: sessao.email, token_tutor: sessao.token });
    if (!r.ok) {
      document.getElementById("contas-semana").innerHTML = `<option>${escapeHtml(r.erro || "Erro ao carregar")}</option>`;
      return;
    }
    contasCalendario = r.ciclos || [];
    contasValorHora = r.valor_hora || 0;
    TIPOS_SERVICO_CONTAS = r.tipos_servico || [];

    renderSemanaOptions();
    document.getElementById("contas-valor-hora-hint").textContent = contasValorHora
      ? `Valor calculado com base na remuneração cadastrada desta tutoria (R$ ${contasValorHora.toFixed(2).replace(".", ",")}/hora) — não é uma tarifa única da plataforma.`
      : "Não encontramos sua remuneração cadastrada — fale com a coordenação.";

    adicionarLinhaServico();
    calcularTotaisContas();
    atualizarBoxNF();
    carregarHistoricoPrestacao();
  } catch (e) {
    document.getElementById("contas-semana").innerHTML = "<option>Não foi possível conectar.</option>";
  }
}

// -------------------------------------------------------
//  Dropdown de semanas — achata todos os ciclos do cronograma
// -------------------------------------------------------
function renderSemanaOptions() {
  const sel = document.getElementById("contas-semana");
  mapaSemanaCiclo = {};
  const opts = [];
  contasCalendario.forEach(ciclo => {
    ciclo.semanas.forEach((sem, idx) => {
      mapaSemanaCiclo[sem] = { periodo_emissao: ciclo.periodo_emissao, ultima: idx === ciclo.semanas.length - 1 };
      opts.push(`<option value="${escapeHtml(sem)}">${escapeHtml(sem)}</option>`);
    });
  });
  sel.innerHTML = opts.join("") || "<option>Nenhuma semana cadastrada</option>";
}

// -------------------------------------------------------
//  Linhas de serviço (tipo + tempo + descrição)
// -------------------------------------------------------
function adicionarLinhaServico(tipoPreset, horasPreset, descPreset) {
  contasLinhaSeq++;
  const id = "contas-linha-" + contasLinhaSeq;
  const wrap = document.createElement("div");
  wrap.id = id;
  wrap.innerHTML = `
    <div class="service-row">
      <select onchange="calcularTotaisContas()">
        ${TIPOS_SERVICO_CONTAS.map(t => `<option ${t === tipoPreset ? "selected" : ""}>${escapeHtml(t)}</option>`).join("")}
      </select>
      <input type="text" placeholder="hh:mm" value="${escapeHtml(horasPreset || "")}" onchange="calcularTotaisContas()">
      <button class="icon-btn" onclick="document.getElementById('${id}').remove(); calcularTotaisContas();">✕</button>
    </div>
    <input class="service-row-desc" type="text" placeholder="Descrição do que foi feito (opcional)" value="${escapeHtml(descPreset || "")}">
  `;
  document.getElementById("contas-linhas").appendChild(wrap);
}

function calcularTotaisContas() {
  const inputs = document.querySelectorAll("#contas-linhas .service-row input[type='text']");
  let totalMin = 0;
  inputs.forEach(inp => {
    const m = inp.value.match(/^(\d{1,2}):([0-5]\d)$/);
    if (m) totalMin += parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  });
  document.getElementById("contas-tot-horas").textContent = formatarMinutos(totalMin);
  document.getElementById("contas-tot-valor").textContent = formatarMoeda((totalMin / 60) * contasValorHora);
  document.getElementById("contas-aviso-limite").style.display = totalMin > 20 * 60 ? "block" : "none";
}

// -------------------------------------------------------
//  NF — só aparece quando a semana selecionada é a última do ciclo
// -------------------------------------------------------
async function atualizarBoxNF() {
  const semana = document.getElementById("contas-semana").value;
  const info = mapaSemanaCiclo[semana];
  const box = document.getElementById("contas-nf-box");
  if (!info || !info.ultima || !info.periodo_emissao) { box.style.display = "none"; return; }
  box.style.display = "block";
  document.getElementById("contas-nf-hint").textContent = `Referente ao período de emissão ${info.periodo_emissao}.`;
  await renderNfBox(info.periodo_emissao);
}

async function renderNfBox(periodo) {
  const inner = document.getElementById("contas-nf-inner");
  inner.innerHTML = '<p class="hint">Carregando...</p>';
  try {
    const r = await chamarBackend("buscar_nf_status", { email: sessao.email, token_tutor: sessao.token, periodo_emissao: periodo });
    if (!r.ok) { inner.innerHTML = `<p class="hint">${escapeHtml(r.erro || "Não foi possível carregar.")}</p>`; return; }
    const nf = r.nf;
    if (!nf.liberado) {
      inner.innerHTML = `<div class="nf-status-msg aguardando">⏳ Aguardando aprovação da coordenação para liberar a emissão da NF deste período.</div>`;
      return;
    }
    if (nf.situacao === "emitida") {
      inner.innerHTML = `
        <div class="nf-status-msg emitida">✓ NF emitida${nf.data_emissao ? " em " + formatarDataISO(nf.data_emissao) : ""}.
        ${nf.arquivo_url ? ` <a href="${escapeHtml(nf.arquivo_url)}" target="_blank" rel="noopener">Ver arquivo anexado</a>` : ""}</div>`;
      return;
    }
    inner.innerHTML = `
      <div class="nf-status-msg liberado">✓ Liberado pela coordenação — você já pode emitir a NF deste período.</div>
      <label style="margin-top:0">Anexar NF (opcional)</label>
      <input type="file" id="contas-nf-arquivo" accept="application/pdf,image/*">
      <button class="btn small" style="margin-top:10px" onclick="marcarNfEmitidaUI('${periodo}')">Marcar como emitida</button>
    `;
  } catch (e) {
    inner.innerHTML = '<p class="hint">Não foi possível conectar. Tente novamente.</p>';
  }
}

function lerArquivoComoBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(file);
  });
}

async function marcarNfEmitidaUI(periodo) {
  const fileInput = document.getElementById("contas-nf-arquivo");
  const file = fileInput && fileInput.files[0];
  const dados = { email: sessao.email, token_tutor: sessao.token, periodo_emissao: periodo };
  try {
    if (file) {
      dados.arquivo_base64 = await lerArquivoComoBase64(file);
      dados.arquivo_nome = file.name;
      dados.arquivo_tipo = file.type || "application/pdf";
    }
    const r = await chamarBackend("marcar_nf_emitida", dados);
    if (!r.ok) { alert(r.erro || "Não foi possível marcar como emitida."); return; }
    await renderNfBox(periodo);
  } catch (e) {
    alert("Não foi possível conectar. Tente novamente.");
  }
}

// -------------------------------------------------------
//  Enviar prestação de contas
// -------------------------------------------------------
async function enviarPrestacaoContasUI() {
  const semana = document.getElementById("contas-semana").value;
  const linhasEls = document.querySelectorAll("#contas-linhas > div");
  const linhas = [];
  linhasEls.forEach(div => {
    const tipo = div.querySelector("select").value;
    const horas = div.querySelector(".service-row input[type='text']").value.trim();
    const descricao = div.querySelector(".service-row-desc").value.trim();
    if (horas) linhas.push({ tipo, horas, descricao });
  });
  const outros = document.getElementById("contas-outros").value.trim();

  if (linhas.length === 0 && !outros) { alert("Adicione ao menos um serviço prestado."); return; }

  try {
    const r = await chamarBackend("enviar_prestacao_contas", {
      email: sessao.email, token_tutor: sessao.token, semana, linhas, outros
    });
    if (!r.ok) { alert(r.erro || "Não foi possível enviar."); return; }
    alert("Prestação de contas enviada com sucesso!");
    document.getElementById("contas-linhas").innerHTML = "";
    adicionarLinhaServico();
    document.getElementById("contas-outros").value = "";
    calcularTotaisContas();
    carregarHistoricoPrestacao();
  } catch (e) {
    alert("Não foi possível conectar. Tente novamente.");
  }
}

// -------------------------------------------------------
//  Histórico
// -------------------------------------------------------
async function carregarHistoricoPrestacao() {
  const loading = document.getElementById("contas-historico-loading");
  const tabela  = document.getElementById("contas-historico-tabela");
  const tbody   = document.getElementById("contas-historico-tbody");
  loading.style.display = "block";
  loading.textContent = "Carregando...";
  tabela.style.display = "none";
  try {
    const r = await chamarBackend("buscar_historico_prestacao", { email: sessao.email, token_tutor: sessao.token });
    if (!r.ok || !r.historico || r.historico.length === 0) {
      tbody.innerHTML = "";
      loading.textContent = r.ok ? "Nenhuma prestação enviada ainda." : (r.erro || "Não foi possível carregar.");
      return;
    }
    loading.style.display = "none";
    const STATUS_LABEL = { validacao: "Em validação", aprovada: "Aprovada", correcao: "Correção necessária" };
    tbody.innerHTML = r.historico.map(h => `
      <tr>
        <td>${escapeHtml(h.semana)}</td>
        <td>${h.enviada_em ? formatarDataISO(h.enviada_em) : "—"}</td>
        <td class="num">${formatarMinutos(h.minutos)}</td>
        <td class="num">${formatarMoeda(h.valor)}</td>
        <td>${escapeHtml(STATUS_LABEL[h.status] || h.status)}</td>
      </tr>
    `).join("");
    tabela.style.display = "table";
  } catch (e) {
    loading.textContent = "Não foi possível conectar. Tente novamente.";
  }
}

// =============================================================
//  DASHBOARD DA TURMA
// =============================================================
let dashVestData = null; // guarda a última resposta pra filtrar localmente no clique dos chips

async function iniciarDashboardTurma() {
  const loading = document.getElementById("dashboard-loading");
  const conteudo = document.getElementById("dashboard-conteudo");
  const secaoTutor = document.getElementById("dash-secao-tutor");
  const filtroPraca = document.getElementById("dash-vest-filtro-praca");
  loading.style.display = "block";
  loading.textContent = "Carregando...";
  conteudo.style.display = "none";

  if (sessao.tipo === "tutor") {
    secaoTutor.style.display = "block";
    filtroPraca.style.display = "none";
    try {
      const r = await chamarBackend("buscar_dashboard_turma", { email: sessao.email, token_tutor: sessao.token });
      if (r.ok) {
        document.getElementById("dash-total-alunos").textContent = r.total_alunos;
        document.getElementById("dash-destaques").textContent = r.destaques_atuais;
        document.getElementById("dash-sem-retorno").textContent = r.sem_retorno.length;
        const card = document.getElementById("dash-sem-retorno-card");
        const lista = document.getElementById("dash-sem-retorno-lista");
        if (r.sem_retorno.length > 0) {
          card.style.display = "block";
          lista.innerHTML = r.sem_retorno.map(a => `
            <div class="aluno-item" style="cursor:default"><div class="nome">${escapeHtml(a.nome)}</div></div>
          `).join("");
        } else {
          card.style.display = "none";
        }
      }
    } catch (e) { /* a seção de vestibular ainda carrega mesmo se essa parte falhar */ }
  } else {
    secaoTutor.style.display = "none";
    filtroPraca.style.display = "block";
  }

  loading.style.display = "none";
  conteudo.style.display = "block";

  carregarDashboardVestibular();
}

// -------------------------------------------------------
//  Estratégias de Vestibular (3EM) — tutor vê a própria turma,
//  coordenação vê todos os tutores comparados (com filtro de praça).
// -------------------------------------------------------
async function carregarDashboardVestibular() {
  const loading = document.getElementById("dash-vest-loading");
  const conteudo = document.getElementById("dash-vest-conteudo");
  loading.style.display = "block";
  loading.textContent = "Carregando...";
  conteudo.style.display = "none";
  document.getElementById("dash-vest-drill").style.display = "none";

  const dados = { email: sessao.email, token_tutor: sessao.token };
  if (sessao.tipo === "coordenacao") {
    const praca = document.getElementById("dash-vest-praca").value;
    if (praca) dados.praca = praca;
  }

  try {
    const r = await chamarBackend("buscar_dashboard_vestibular", dados);
    if (!r.ok) { loading.textContent = r.erro || "Não foi possível carregar."; return; }
    dashVestData = r;

    renderPreenchimentoVestibular(r);
    renderPosicaoVestibular(r);
    renderChipsPosicaoVestibular(r);
    renderQuadrantesVestibular(r);
    renderPrivadasVestibular(r);

    loading.style.display = "none";
    conteudo.style.display = "block";
  } catch (e) {
    loading.textContent = "Não foi possível conectar. Tente novamente.";
  }
}

function renderPreenchimentoVestibular(r) {
  const wrap = document.getElementById("dash-vest-preenchimento");
  if (r.escopo === "tutor") {
    const t = r.tutores[0] || { total_alunos_3em: 0, acessou_hub: 0, preencheu_10: 0, preencheu_parcial: 0, nao_preencheu: 0 };
    wrap.innerHTML = `
      <div class="stat-grid">
        <div class="stat-tile"><div class="label">Alunos 3EM</div><div class="value">${t.total_alunos_3em}</div></div>
        <div class="stat-tile"><div class="label">Já acessaram o Hub</div><div class="value">${t.acessou_hub}</div></div>
        <div class="stat-tile"><div class="label">Preencheram as 10</div><div class="value">${t.preencheu_10}</div></div>
        <div class="stat-tile"><div class="label">Parcial / Nenhuma</div><div class="value">${t.preencheu_parcial} / ${t.nao_preencheu}</div></div>
      </div>`;
  } else {
    if (r.tutores.length === 0) { wrap.innerHTML = '<p class="hint">Nenhum aluno de 3EM encontrado nesse filtro.</p>'; return; }
    wrap.innerHTML = `
      <table>
        <thead><tr><th>Tutor(a)</th><th class="num">Alunos 3EM</th><th class="num">Acessaram o Hub</th><th class="num">Preencheram as 10</th><th class="num">Parcial</th><th class="num">Nenhuma</th></tr></thead>
        <tbody>
          ${r.tutores.map(t => `
            <tr>
              <td>${escapeHtml(t.tutor_nome)}</td>
              <td class="num">${t.total_alunos_3em}</td>
              <td class="num">${t.acessou_hub}</td>
              <td class="num">${t.preencheu_10}</td>
              <td class="num">${t.preencheu_parcial}</td>
              <td class="num">${t.nao_preencheu}</td>
            </tr>`).join("")}
        </tbody>
      </table>`;
  }
}

// -------------------------------------------------------
//  Posição das escolhas recomendadas (mutuamente exclusivo —
//  sempre soma o total de alunos do escopo)
// -------------------------------------------------------
const POSICOES_VEST = [
  { id: "top3",     label: "Recomendada nas 3 primeiras" },
  { id: "restante", label: "Recomendada só nas 7 últimas" },
  { id: "nenhuma",  label: "Sem nenhuma recomendada" },
];

function renderPosicaoVestibular(r) {
  const wrap = document.getElementById("dash-vest-posicao");
  if (r.escopo === "tutor") {
    const t = r.tutores[0] || { posicao: { top3: 0, restante: 0, nenhuma: 0 } };
    wrap.innerHTML = `
      <div class="stat-grid" style="grid-template-columns: repeat(3, 1fr)">
        <div class="stat-tile"><div class="label">3 primeiras escolhas</div><div class="value">${t.posicao.top3}</div></div>
        <div class="stat-tile"><div class="label">Só nas 7 últimas</div><div class="value">${t.posicao.restante}</div></div>
        <div class="stat-tile"><div class="label">Nenhuma recomendada</div><div class="value">${t.posicao.nenhuma}</div></div>
      </div>`;
  } else {
    if (r.tutores.length === 0) { wrap.innerHTML = ""; return; }
    wrap.innerHTML = `
      <table>
        <thead><tr><th>Tutor(a)</th><th class="num">3 primeiras</th><th class="num">Só 7 últimas</th><th class="num">Nenhuma</th></tr></thead>
        <tbody>
          ${r.tutores.map(t => `
            <tr>
              <td>${escapeHtml(t.tutor_nome)}</td>
              <td class="num">${t.posicao.top3}</td>
              <td class="num">${t.posicao.restante}</td>
              <td class="num">${t.posicao.nenhuma}</td>
            </tr>`).join("")}
        </tbody>
      </table>`;
  }
}

function renderChipsPosicaoVestibular(r) {
  const contagens = { top3: 0, restante: 0, nenhuma: 0 };
  r.alunos.forEach(a => { contagens[a.posicao_recomendada]++; });
  const wrap = document.getElementById("dash-vest-chips-posicao");
  wrap.innerHTML = POSICOES_VEST.map(p => `
    <button class="chip" onclick="mostrarAlunosPosicaoVestibular('${p.id}')">${escapeHtml(p.label)} — ${contagens[p.id]}</button>
  `).join("");
}

function mostrarAlunosPosicaoVestibular(posicaoId) {
  if (!dashVestData) return;
  const posInfo = POSICOES_VEST.find(p => p.id === posicaoId);
  const alunos = dashVestData.alunos.filter(a => a.posicao_recomendada === posicaoId);

  const drill = document.getElementById("dash-vest-drill");
  const titulo = document.getElementById("dash-vest-drill-titulo");
  const lista = document.getElementById("dash-vest-drill-lista");

  titulo.textContent = `${posInfo.label} (${alunos.length})`;
  if (alunos.length === 0) {
    lista.innerHTML = '<p class="hint">Nenhum aluno nesse grupo.</p>';
  } else {
    lista.innerHTML = alunos.map(a => {
      const linhasEscolhas = a.escolhas.map(e => {
        let linha = `${escapeHtml(e.letra)}) ${escapeHtml(e.curso)} — ${escapeHtml(e.universidade)}`;
        linha += e.recomendada ? " · recomendada" : " · não recomendada";
        return `<div class="escolha-linha${e.recomendada ? " escolha-destaque" : ""}">${e.recomendada ? "★ " : ""}${linha}</div>`;
      }).join("");
      return `
        <div class="aluno-item" style="cursor:default">
          <div class="nome">${escapeHtml(a.nome)}${dashVestData.escopo === "coordenacao" ? " · " + escapeHtml(a.tutor) : ""}</div>
          <div class="sub">${linhasEscolhas}</div>
        </div>`;
    }).join("");
  }
  drill.style.display = "block";
}

// -------------------------------------------------------
//  Escolhas em universidades privadas (sem nota de corte na SISU —
//  ajuda a distinguir "não tem nota porque é vestibular próprio" de
//  "não tem nota porque não bateu o corte")
// -------------------------------------------------------
function renderPrivadasVestibular(r) {
  const total = r.alunos.reduce((acc, a) => acc + a.escolhas.filter(e => e.provavel_privada).length, 0);
  const el = document.getElementById("dash-vest-privadas");
  el.innerHTML = `🏫 ${total} escolha(s) em universidades privadas/vestibular próprio (sem nota de corte na SISU) — clique para ver`;
  el.onclick = mostrarEscolhasPrivadas;
}

function mostrarEscolhasPrivadas() {
  if (!dashVestData) return;
  const drill = document.getElementById("dash-vest-drill");
  const titulo = document.getElementById("dash-vest-drill-titulo");
  const lista = document.getElementById("dash-vest-drill-lista");

  const porAluno = dashVestData.alunos
    .map(a => ({ aluno: a, escolhas: a.escolhas.filter(e => e.provavel_privada) }))
    .filter(x => x.escolhas.length > 0);

  const totalEscolhas = porAluno.reduce((acc, x) => acc + x.escolhas.length, 0);
  titulo.textContent = `Escolhas em universidades privadas (${totalEscolhas})`;
  if (porAluno.length === 0) {
    lista.innerHTML = '<p class="hint">Nenhuma escolha nessa condição.</p>';
  } else {
    lista.innerHTML = porAluno.map(x => {
      const linhas = x.escolhas.map(e => `
        <div class="escolha-linha escolha-destaque">★ ${escapeHtml(e.letra)}) ${escapeHtml(e.curso)} — ${escapeHtml(e.universidade)}${e.recomendada ? " · recomendada" : ""}</div>
      `).join("");
      return `
        <div class="aluno-item" style="cursor:default">
          <div class="nome">${escapeHtml(x.aluno.nome)}${dashVestData.escopo === "coordenacao" ? " · " + escapeHtml(x.aluno.tutor) : ""}</div>
          <div class="sub">${linhas}</div>
        </div>`;
    }).join("");
  }
  drill.style.display = "block";
}

const GRUPOS_VEST = [
  { id: "com_nota_recomendada",     label: "Com nota e recomendada",     cor: "#00838F", bg: "#E3F6F8",
    desc: "Nota suficiente para pelo menos uma escolha recomendada." },
  { id: "recomendada_sem_nota",     label: "Recomendada, sem nota",      cor: "#A68A00", bg: "#FFF9E0",
    desc: "Tem escolha recomendada, mas a nota está abaixo do corte dela." },
  { id: "com_nota_nao_recomendada", label: "Com nota, não recomendada",  cor: "#5C6B85", bg: "#F0F2F5",
    desc: "Nota competitiva, mas nenhuma escolha com nota é recomendada." },
  { id: "sem_nota_sem_recomendada", label: "Sem nota e sem recomendada", cor: "#C41E4B", bg: "#FDECF2",
    desc: "Nota e escolha recomendada, as duas, a desenvolver." },
];

// ---- Quadrantes clicáveis (substituem o gráfico de barras) ----
function renderQuadrantesVestibular(r) {
  const total = r.alunos.length;
  const contagens = { com_nota_recomendada: 0, recomendada_sem_nota: 0, com_nota_nao_recomendada: 0, sem_nota_sem_recomendada: 0 };
  r.alunos.forEach(a => a.grupos.forEach(g => { if (g in contagens) contagens[g]++; }));

  document.getElementById("dash-vest-nota-total-hint").textContent =
    total > 0 ? `${total} aluno(s) de 3EM no total (um aluno pode contar em mais de um quadrante, se tiver escolhas diferentes).` : "";

  const wrap = document.getElementById("dash-vest-quadrantes");
  wrap.innerHTML = GRUPOS_VEST.map(g => {
    const n = contagens[g.id];
    const pct = total > 0 ? ((n / total) * 100).toFixed(1).replace(".", ",") : "0,0";
    return `
      <div class="quad-box" style="background:${g.bg}; border-color:${g.cor}" onclick="mostrarAlunosGrupoVestibular('${g.id}')">
        <div class="titulo">${escapeHtml(g.label)}</div>
        <div class="num" style="color:${g.cor}">${n}</div>
        <div class="pct" style="color:${g.cor}">${pct}%</div>
        <div class="desc">${escapeHtml(g.desc)}</div>
      </div>`;
  }).join("");

  // Coordenação também vê a comparação por tutor, numa tabela (o quadrante
  // acima é sempre o agregado do filtro atual — praça ou geral).
  const tabelaWrap = document.getElementById("dash-vest-tabela-tutores");
  if (r.escopo === "coordenacao" && r.tutores.length > 0) {
    tabelaWrap.innerHTML = `
      <table>
        <thead><tr><th>Tutor(a)</th>${GRUPOS_VEST.map(g => `<th class="num">${escapeHtml(g.label)}</th>`).join("")}</tr></thead>
        <tbody>
          ${r.tutores.map(t => `
            <tr>
              <td>${escapeHtml(t.tutor_nome)}</td>
              ${GRUPOS_VEST.map(g => `<td class="num">${t.grupos[g.id]}</td>`).join("")}
            </tr>`).join("")}
        </tbody>
      </table>`;
  } else {
    tabelaWrap.innerHTML = "";
  }
}

// ---- Tabela de distância até o corte (só pro quadrante "recomendada, sem nota") ----
function montarTabelaDistancia(alunos, grupoId) {
  const faixas = [
    { id: "perto",  label: "Até 10 pts abaixo do corte" },
    { id: "medio",  label: "11–50 pts abaixo do corte" },
    { id: "longe",  label: "Mais de 50 pts abaixo do corte" },
  ];
  const porFaixa = { perto: [], medio: [], longe: [] };

  alunos.forEach(a => {
    const candidatas = a.escolhas.filter(e => e.grupo === grupoId && e.proximidade && a.pu2 !== null && e.nota_corte !== null);
    if (candidatas.length === 0) return;
    const ordem = { perto: 0, medio: 1, longe: 2 };
    candidatas.sort((x, y) => ordem[x.proximidade] - ordem[y.proximidade]);
    const rep = candidatas[0]; // a escolha mais próxima do corte representa o aluno
    porFaixa[rep.proximidade].push(rep.nota_corte - a.pu2);
  });

  const linhas = faixas.map(f => {
    const dist = porFaixa[f.id];
    if (dist.length === 0) return `<tr><td>${f.label}</td><td class="num">0</td><td class="num">—</td><td class="num">—</td><td class="num">—</td></tr>`;
    const media = (dist.reduce((a, b) => a + b, 0) / dist.length).toFixed(1);
    const min = Math.min(...dist).toFixed(1);
    const max = Math.max(...dist).toFixed(1);
    return `<tr><td>${f.label}</td><td class="num">${dist.length}</td><td class="num">${media} pts</td><td class="num">${min} pts</td><td class="num">${max} pts</td></tr>`;
  }).join("");

  return `
    <table style="margin-bottom:18px">
      <thead><tr><th>Faixa de distância</th><th class="num">Alunos</th><th class="num">Média</th><th class="num">Mín.</th><th class="num">Máx.</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>`;
}

function mostrarAlunosGrupoVestibular(grupoId) {
  if (!dashVestData) return;
  const grupoInfo = GRUPOS_VEST.find(g => g.id === grupoId);
  const alunos = dashVestData.alunos.filter(a => a.grupos.includes(grupoId));

  const drill = document.getElementById("dash-vest-drill");
  const titulo = document.getElementById("dash-vest-drill-titulo");
  const lista = document.getElementById("dash-vest-drill-lista");
  const tabelaWrap = document.getElementById("dash-vest-drill-tabela");

  tabelaWrap.innerHTML = grupoId === "recomendada_sem_nota" ? montarTabelaDistancia(alunos, grupoId) : "";

  titulo.textContent = `${grupoInfo.label} (${alunos.length})`;
  if (alunos.length === 0) {
    lista.innerHTML = '<p class="hint">Nenhum aluno nesse grupo.</p>';
  } else {
    lista.innerHTML = alunos.map(a => {
      // Mostra TODAS as escolhas do aluno — a(s) que bateu(ram) com o
      // grupo clicado fica(m) sinalizada(s) com ★, não escondemos o resto.
      const linhasEscolhas = a.escolhas.map(e => {
        const destaque = e.grupo === grupoId;
        let linha = `${escapeHtml(e.letra)}) ${escapeHtml(e.curso)} — ${escapeHtml(e.universidade)}`;
        linha += e.recomendada ? " · recomendada" : " · não recomendada";
        linha += e.nota_corte !== null ? ` · corte ${e.nota_corte}` : " · sem corte encontrado";
        if (e.proximidade) linha += ` · ${e.proximidade === "perto" ? "perto da nota" : e.proximidade === "medio" ? "distância média" : "longe da nota"}`;
        return `<div class="escolha-linha${destaque ? " escolha-destaque" : ""}">${destaque ? "★ " : ""}${linha}</div>`;
      }).join("");
      return `
        <div class="aluno-item" style="cursor:default">
          <div class="nome">${escapeHtml(a.nome)}${dashVestData.escopo === "coordenacao" ? " · " + escapeHtml(a.tutor) : ""}${a.pu2 !== null ? " · PU2: " + a.pu2 : " · sem PU2"}</div>
          <div class="sub">${linhasEscolhas}</div>
        </div>`;
    }).join("");
  }
  drill.style.display = "block";
}

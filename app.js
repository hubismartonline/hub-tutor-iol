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

  carregarMeusAlunos();
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
      <div class="sub">${escapeHtml(a.serie || "")}${a.cidade ? " · " + escapeHtml(a.cidade) : ""}${a.tutor ? " · " + escapeHtml(a.tutor) : ""}</div>
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
      <p class="hint">${escapeHtml(aluno.serie)} · ${escapeHtml(aluno.cidade)} · Tutor(a): ${escapeHtml(aluno.tutor)}</p>
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

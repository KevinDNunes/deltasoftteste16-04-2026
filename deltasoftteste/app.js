const STORAGE_KEY = 'deltasoft_v9';

const defaultData = {
  currentUserId: null,
  users: [
    { id: 1, name: 'Kevin', email: 'admin@teste.com', password: '123', role: 'admin', photo: '', cpf: '123.456.789-00' },
    { id: 2, name: 'Financeiro Teste', email: 'fin@teste.com', password: '123', role: 'financeiro', photo: '', cpf: '987.654.321-00' },
    { id: 3, name: 'Técnico Teste', email: 'tec@teste.com', password: '123', role: 'tecnico', photo: '', cpf: '456.789.123-00' }
  ],
  trips: [],
  cards: [],
  companies: [
    { id: 1, name: 'Deltafrio', cnpj: '00.000.000/0001-00' },
    { id: 2, name: 'Deltalab', cnpj: '11.111.111/0001-11' }
  ],
  documentIndex: []
};

let state = loadData();
let currentView = 'dashboard';
let reportFilters = { start: '', end: '', text: '' };
let historyFilters = { start: '', end: '', text: '' };
let signaturePad = null;
let pendingSignatureTripId = null;
let pendingSignatureForFinance = null;

const refs = {
  loginScreen: qs('#loginScreen'),
  appScreen: qs('#appScreen'),
  loginForm: qs('#loginForm'),
  loginEmail: qs('#loginEmail'),
  loginPassword: qs('#loginPassword'),
  dashboardView: qs('#dashboardView'),
  menuNav: qs('#menuNav'),
  welcomeText: qs('#welcomeText'),
  logoutBtn: qs('#logoutBtn'),
  sidebar: qs('#sidebar'),
  menuToggle: qs('#menuToggle'),
  profileName: qs('#profileName'),
  profileRole: qs('#profileRole'),
  profileAvatar: qs('#profileAvatar'),
  profilePhotoInput: qs('#profilePhotoInput')
};

const MENU = {
  admin: [
    ['dashboard', 'Visão geral', '📊'],
    ['users', 'Usuários', '👥'],
    ['finance', 'Financeiro', '💰'],
    ['history', 'Histórico', '🧾'],
    ['reports', 'PDFs', '📄']
  ],
  financeiro: [
    ['dashboard', 'Painel', '📊'],
    ['requests', 'Solicitações', '📨'],
    ['cards', 'Cartões', '💳'],
    ['history', 'Histórico', '🧾'],
    ['reports', 'PDFs', '📄']
  ],
  tecnico: [
    ['dashboard', 'Minha área', '🏠'],
    ['myTrips', 'Minhas viagens', '🧳'],
    ['expenses', 'Meus gastos', '💸'],
    ['history', 'Histórico', '🗂️'],
    ['reports', 'Relatórios', '📄']
  ],
  representante: [
    ['dashboard', 'Minha área', '🏠'],
    ['myTrips', 'Minhas viagens', '🧳'],
    ['expenses', 'Meus gastos', '💸'],
    ['history', 'Histórico', '🗂️'],
    ['reports', 'Relatórios', '📄']
  ]
};

function qs(s) { return document.querySelector(s); }

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
    return structuredClone(defaultData);
  }
  return JSON.parse(raw);
}

function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function currentUser() { return state.users.find(u => u.id === state.currentUserId) || null; }

function nextId(arr) { return arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1; }

function money(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

function fmtDate(v) {
  if (!v) return '-';
  const [y, m, d] = v.split('-');
  return `${d}/${m}/${y}`;
}

function todayISO() { return new Date().toISOString().split('T')[0]; }

function parseDate(v) { return v ? new Date(v + 'T12:00:00') : null; }

function inRange(v, s, e) {
  if (!v) return false;
  const d = parseDate(v);
  if (s && d < parseDate(s)) return false;
  if (e && d > parseDate(e)) return false;
  return true;
}

function tripTotal(t) { return (t.expenses || []).reduce((a, b) => a + Number(b.amount || 0), 0); }

function tripLabel(t) { return `Viagem ${t?.serviceLocation || '#' + t?.id}`; }

function settlementAmount(t) { return Number(totalApprovedResources(t) || 0) - Number(tripTotal(t) || 0); }

function settlementLabel(t) {
  const saldo = settlementAmount(t);
  if (saldo > 0) return `Valor a devolver: ${money(saldo)}`;
  if (saldo < 0) return `Valor a receber de volta: ${money(Math.abs(saldo))}`;
  return 'Sem diferença de acerto.';
}

function totalApprovedResources(t) {
  const base = Number(t.cardAmount || 0) + Number(t.cashAmount || 0);
  const extra = (t.extraFunds || []).filter(x => x.status === 'aprovado').reduce((a, b) => a + Number(b.totalAmount || 0), 0);
  return base + extra;
}

function activeTripForUser(id) { return state.trips.find(t => t.userId === id && !['finalizada', 'recusada'].includes(t.status)); }

function isTechLikeRole(role) { return ['tecnico', 'representante'].includes(role); }

function getRoleLabel(r) { return r === 'admin' ? 'Administrador(a)' : r === 'financeiro' ? 'Financeiro(a)' : r === 'representante' ? 'Representante' : 'Técnico(a)'; }

function getCompanyByTrip(trip) { return state.companies.find(c => c.name === trip.company) || { name: trip.company, cnpj: '-' }; }

function formatDateExtended() {
  const now = new Date();
  const dias = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const diaSemana = dias[now.getDay()];
  const dia = now.getDate();
  const mes = meses[now.getMonth()];
  const ano = now.getFullYear();
  const hora = now.toLocaleTimeString('pt-BR');
  return `${diaSemana}, ${dia} de ${mes} de ${ano} às ${hora}`;
}

function avatarFallback(name = 'U') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#0a4fab"/><stop offset="1" stop-color="#0f5ec9"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="72" fill="white" font-weight="700">${(name[0] || 'U').toUpperCase()}</text></svg>`;
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

function badge(s) {
  const map = {
    pendente: 'Pendente',
    aguardando_assinatura: 'Aguardando assinatura',
    aprovada: 'Aprovada',
    em_andamento: 'Em andamento',
    aguardando_acerto: 'Aguardando acerto',
    finalizada: 'Finalizada',
    recusada: 'Recusada',
    aguardando_assinatura_financeiro: 'Aguardando assinatura do financeiro'
  };
  return `<span class="badge status-${s}">${map[s] || s}</span>`;
}

function sectionHead(t, s, actions = '') {
  return `<div class="page-head"><div><h3>${t}</h3><p>${s}</p></div>${actions}</div>`;
}

function renderMetric(l, v, i) {
  return `<article class="metric-card"><div><p class="metric-label">${l}</p><strong class="metric-value">${v}</strong></div><span class="metric-icon">${i}</span></article>`;
}

function modal(title, html, isImageViewer = false) {
  const existingModal = qs('#activeModal');
  if (existingModal) existingModal.remove();
  if (signaturePad) signaturePad = null;
  
  const wrap = document.createElement('div');
  wrap.id = 'activeModal';
  wrap.className = 'modal-backdrop' + (isImageViewer ? ' image-viewer-modal' : '');
  wrap.innerHTML = `<div class="modal"><div class="${isImageViewer ? 'modal-content' : ''}"><div class="page-head"><div><h3>${title}</h3></div><button class="btn btn-ghost" type="button" onclick="closeModal()">Fechar</button></div>${html}</div></div>`;
  document.body.appendChild(wrap);
  setupMoneyFormatting();
}

function closeModal() { 
  const modalEl = qs('#activeModal');
  if (modalEl) modalEl.remove();
  if (signaturePad) {
    signaturePad.clear();
    signaturePad = null;
  }
  pendingSignatureTripId = null;
  pendingSignatureForFinance = null;
}
window.closeModal = closeModal;

function showRejectionReason(tripId) {
  const trip = state.trips.find(t => t.id === tripId);
  if (!trip || !trip.rejectionReason) {
    alert('Nenhum motivo de recusa foi registrado para esta viagem.');
    return;
  }
  
  modal('Motivo da recusa', `
    <div style="text-align: center;">
      <div style="font-size: 4rem; margin-bottom: 16px;">📄</div>
      <div class="legal-notice" style="background: #fff0f2; border-left-color: var(--danger);">
        <strong>⚠️ Viagem Recusada</strong>
        <p style="margin-top: 12px; white-space: pre-wrap;">${trip.rejectionReason}</p>
      </div>
      <button class="btn btn-primary" onclick="closeModal()">Entendi</button>
    </div>
  `);
}
window.showRejectionReason = showRejectionReason;

function fileToData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function upsertDocument(matchFn, obj) {
  const existing = state.documentIndex.find(matchFn);
  if (existing) {
    Object.assign(existing, obj);
    return existing;
  }
  const created = { id: nextId(state.documentIndex), ...obj };
  state.documentIndex.push(created);
  return created;
}

function imagePreviewHtml(data, alt = 'Imagem do documento') {
  if (!data || typeof data !== 'string') return '';
  if (data.startsWith('data:image')) {
    return `<div class="pdf-block"><p><strong>Documento anexado:</strong></p><img src="${data}" alt="${alt}" style="width:100%;max-width:780px;border-radius:14px;border:1px solid #d7e4f3;object-fit:contain"></div>`;
  }
  return `<div class="pdf-block"><p><strong>Documento anexado:</strong> ${alt}</p><a href="${data}" download class="btn btn-secondary">Baixar documento</a></div>`;
}

function filteredDocuments(filters, role, userId) {
  let list = [...state.documentIndex];
  if (isTechLikeRole(role)) list = list.filter(d => d.userId === userId);
  if (filters.start) list = list.filter(d => inRange(d.docDate, filters.start, ''));
  if (filters.end) list = list.filter(d => inRange(d.docDate, '', filters.end));
  if (filters.text) {
    const q = filters.text.toLowerCase();
    list = list.filter(d => {
      const user = state.users.find(u => u.id === d.userId);
      return [d.title, d.type, d.fileName, user?.name || ''].join(' ').toLowerCase().includes(q);
    });
  }
  return list.sort((a, b) => (b.docDate || '').localeCompare(a.docDate || ''));
}

function filteredTrips(filters, role, userId) {
  let list = isTechLikeRole(role) ? state.trips.filter(t => t.userId === userId) : [...state.trips];
  if (filters.start) list = list.filter(t => inRange(t.startDate, filters.start, ''));
  if (filters.end) list = list.filter(t => inRange(t.startDate, '', filters.end));
  if (filters.text) {
    const q = filters.text.toLowerCase();
    list = list.filter(t => {
      const user = state.users.find(u => u.id === t.userId);
      return [t.company, t.serviceLocation, String(t.id), user?.name || ''].join(' ').toLowerCase().includes(q);
    });
  }
  return list.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
}

function activeAndApprovedTripsForUser(userId) {
  return state.trips.filter(t => t.userId === userId && ['aprovada', 'em_andamento'].includes(t.status));
}

function setupMoneyFormatting() {
  document.querySelectorAll('.money-field').forEach(el => {
    if (el.dataset.bound === '1') return;
    el.dataset.bound = '1';
    const hidden = qs('#' + el.dataset.target);
    const sync = () => {
      const v = Number(hidden.value || 0);
      el.value = v ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
    };
    el.addEventListener('input', () => {
      const digits = el.value.replace(/\D/g, '');
      const n = Number(digits || 0) / 100;
      hidden.value = n.toFixed(2);
      el.value = digits ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
    });
    sync();
  });
}

function initSignaturePad(canvasId, clearBtnId) {
  const canvas = qs(canvasId);
  if (!canvas) return null;
  
  const container = canvas.parentElement;
  const width = Math.min(container.clientWidth - 32, 500);
  canvas.width = width;
  canvas.height = 180;
  canvas.style.width = `${width}px`;
  canvas.style.height = '180px';
  
  const pad = new SignaturePad(canvas, {
    backgroundColor: 'rgb(255, 255, 255)',
    penColor: 'rgb(15, 94, 201)',
    minWidth: 1,
    maxWidth: 2
  });
  
  const clearBtn = qs(clearBtnId);
  if (clearBtn) {
    clearBtn.addEventListener('click', () => pad.clear());
  }
  
  return pad;
}

function goTo(view) { currentView = view; renderApp(); }
window.goTo = goTo;

function renderApp() {
  const user = currentUser();
  if (!user) {
    refs.loginScreen.classList.remove('hidden');
    refs.appScreen.classList.add('hidden');
    return;
  }
  refs.loginScreen.classList.add('hidden');
  refs.appScreen.classList.remove('hidden');
  refs.welcomeText.textContent = `${user.name} • CPF: ${user.cpf || 'Não informado'} • ${getRoleLabel(user.role)}`;
  refs.profileName.textContent = user.name;
  refs.profileRole.textContent = `${getRoleLabel(user.role)} • CPF: ${user.cpf || 'Não informado'}`;
  refs.profileAvatar.src = user.photo || avatarFallback(user.name);
  renderMenu(user.role);
  renderView();
}

function renderMenu(role) {
  refs.menuNav.innerHTML = '';
  MENU[role].forEach(([key, label, icon]) => {
    const btn = document.createElement('button');
    btn.className = 'menu-btn' + (currentView === key ? ' active' : '');
    btn.type = 'button';
    btn.innerHTML = `<span class="menu-icon">${icon}</span><span class="menu-label">${label}</span>`;
    btn.onclick = () => {
      currentView = key;
      renderApp();
      if (innerWidth <= 980) refs.sidebar.classList.remove('open');
    };
    refs.menuNav.appendChild(btn);
  });
}

function renderView() {
  const user = currentUser();
  if (user.role === 'admin') return renderAdmin();
  if (user.role === 'financeiro') return renderFinance();
  return renderTech();
}

function renderAdmin() {
  if (currentView === 'users') return renderUsers();
  if (currentView === 'finance') return renderAdminFinance();
  if (currentView === 'history') return renderHistory();
  if (currentView === 'reports') return renderReports();
  renderAdminDashboard();
}

function renderFinance() {
  if (currentView === 'requests') return renderFinanceRequests();
  if (currentView === 'cards') return renderCards();
  if (currentView === 'history') return renderHistory();
  if (currentView === 'reports') return renderReports();
  renderFinanceDashboard();
}

function renderTech() {
  if (currentView === 'myTrips') return renderMyTrips();
  if (currentView === 'expenses') return renderExpenses();
  if (currentView === 'history') return renderHistory();
  if (currentView === 'reports') return renderReports();
  renderTechDashboard();
}

function renderAdminDashboard() {
  const openTrips = state.trips.filter(t => !['finalizada', 'recusada'].includes(t.status)).length;
  refs.dashboardView.innerHTML = `${sectionHead('Visão geral', 'Acompanhamento completo do sistema interno.', `<div class="actions"><button class="btn btn-secondary" type="button" onclick="openCompanyModal()">CNPJs</button><button class="btn btn-danger" type="button" onclick="resetTestData()">Limpar teste</button></div>`)}<section class="grid metrics-grid">${renderMetric('Usuários', state.users.length, '👥')}${renderMetric('Viagens abertas', openTrips, '🧳')}${renderMetric('PDFs e termos', state.documentIndex.length, '📄')}${renderMetric('Cartões', state.cards.length, '💳')}</section>`;
}

function renderUsers() {
  refs.dashboardView.innerHTML = `${sectionHead('Usuários e permissões', 'Cadastre pessoas e altere os perfis de acesso.', `<button class="btn btn-primary" type="button" onclick="openUserModal()">+ Novo usuário</button>`)}<section class="panel"><div class="stack">${state.users.map(u => `<div class="item-card"><div class="item-top"><div><h5 class="item-title">${u.name}</h5><p class="item-sub">${u.email} • CPF: ${u.cpf || 'Não informado'}</p></div><div class="pill-inline">${getRoleLabel(u.role)}</div></div><div class="actions"><select onchange="changeRole(${u.id}, this.value)"><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option><option value="financeiro" ${u.role === 'financeiro' ? 'selected' : ''}>Financeiro</option><option value="tecnico" ${u.role === 'tecnico' ? 'selected' : ''}>Técnico</option><option value="representante" ${u.role === 'representante' ? 'selected' : ''}>Representante</option></select></div></div>`).join('')}</div></section>`;
}

function renderAdminFinance() {
  refs.dashboardView.innerHTML = `${sectionHead('Financeiro em tempo real', 'Acompanhe valores, recursos aprovados e documentos.')}<section class="panel"><table class="table"><thead><tr><th>Usuário</th><th>Empresa</th><th>Previsto</th><th>Recursos</th><th>Gastos</th><th>Status</th></tr></thead><tbody>${state.trips.length ? state.trips.map(t => {
    const u = state.users.find(x => x.id === t.userId);
    return `<tr>
      <td>${u?.name || '-'} • CPF: ${u?.cpf || '-'}</td>
      <td>${t.company}</td>
      <td>${money(t.plannedAmount)}</td>
      <td>${money(totalApprovedResources(t))}</td>
      <td>${money(tripTotal(t))}</td>
      <td>${badge(t.status)}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="6">Sem viagens cadastradas.</td></tr>`}</tbody></table></section>`;
}

function financeTripCard(t) {
  const u = state.users.find(x => x.id === t.userId);
  const pendingExtras = (t.extraFunds || []).filter(x => x.status === 'pendente');
  const canApprove = t.status === 'pendente';
  const canUploadRelease = t.status === 'aguardando_assinatura';
  const canClose = t.status === 'aguardando_acerto';
  const canSignFinance = t.status === 'aguardando_assinatura_financeiro';
  const canApproveExtension = !!t.extensionRequestedUntil && t.extensionRequestedUntil !== t.extensionApprovedUntil;
  const isRejected = t.status === 'recusada';
  const isPendingCancellation = t.status === 'cancelamento_solicitado';

  return `<div class="item-card"><div class="item-top"><div><h5 class="item-title">${u?.name || '-'} • CPF: ${u?.cpf || '-'} • ${t.company}</h5><p class="item-sub">${fmtDate(t.startDate)} até ${fmtDate(t.endDate)} • Serviço em ${t.serviceLocation}</p></div><div style="display: flex; align-items: center; gap: 8px;">${badge(t.status)}${isRejected ? `<button class="btn btn-ghost" style="padding: 6px 10px;" onclick="showRejectionReason(${t.id})" title="Ver motivo da recusa">📄</button>` : ''}${isPendingCancellation ? `<button class="btn btn-ghost" style="padding: 6px 10px;" onclick="showCancellationReason(${t.id})" title="Ver motivo do cancelamento solicitado">📄</button>` : ''}</div></div><div class="small">Previsto: ${money(t.plannedAmount)} • Recursos aprovados: ${money(totalApprovedResources(t))}</div><div class="small">Pagamento: ${t.paymentTypeLabel || 'Ainda não definido'} • Gasto lançado: ${money(tripTotal(t))}</div><div class="small">Termo de liberação: ${t.releaseTermGeneratedFile ? t.releaseTermGeneratedFile.name : 'Não gerado'}</div><div class="small">Documento do termo: ${t.releaseTermPhotoFile ? t.releaseTermPhotoFile.name : 'Não anexado'}</div>${pendingExtras.length ? `<div class="note">Pedido extra pendente: ${pendingExtras.map(x => money(x.totalAmount)).join(', ')}</div>` : ''}${isPendingCancellation ? `<div class="legal-notice" style="margin: 12px 0;"><strong>📋 Pedido de cancelamento:</strong> ${t.cancellationReason || 'Motivo não informado'}<br><small>Solicitado em: ${fmtDate(t.cancellationRequestedAt)}</small></div><div class="actions"><button class="btn btn-success" type="button" onclick="approveCancellation(${t.id})">✅ Aprovar cancelamento</button><button class="btn btn-danger" type="button" onclick="rejectCancellation(${t.id})">❌ Recusar cancelamento</button></div>` : `<div class="actions">${canApprove ? `<button class="btn btn-success" type="button" onclick="openApproveModal(${t.id}, 'cartao')">Aceitar com cartão</button><button class="btn btn-secondary" type="button" onclick="openApproveModal(${t.id}, 'dinheiro')">Aceitar com dinheiro</button><button class="btn btn-warning" type="button" onclick="openApproveModal(${t.id}, 'misto')">Aceitar misto</button><button class="btn btn-danger" type="button" onclick="rejectTrip(${t.id})">Recusar</button>` : ''}${t.releaseTermGeneratedFile ? `<button class="btn btn-secondary" type="button" onclick="openReleaseTermPreview(${t.id})">Ver termo</button><a class="btn btn-ghost" href="${t.releaseTermGeneratedFile.data}" download="${t.releaseTermGeneratedFile.name}">Baixar termo</a>` : ''}${canUploadRelease ? `<button class="btn btn-primary" type="button" onclick="openReleaseTermModal(${t.id})">Anexar termo assinado</button>` : ''}${canApproveExtension ? `<button class="btn btn-warning" type="button" onclick="approveExtension(${t.id})">Aprovar dias adicionais</button>` : ''}${pendingExtras.length ? `<button class="btn btn-secondary" type="button" onclick="openExtraFundsApprovalModal(${t.id})">Analisar pedido extra</button>` : ''}${canClose ? `<button class="btn btn-primary" type="button" onclick="viewPendingSignature(${t.id})">Ver termo e assinar</button>` : ''}${canSignFinance ? `<button class="btn btn-primary" type="button" onclick="openFinanceSignature(${t.id})">Assinar termo final</button>` : ''}</div>`}</div>`;
}

function showCancellationReason(tripId) {
  const trip = state.trips.find(t => t.id === tripId);
  if (!trip) {
    alert('Viagem não encontrada.');
    return;
  }
  
  let title = '';
  let reason = '';
  let extraInfo = '';
  
  if (trip.status === 'cancelamento_solicitado') {
    title = '📋 Pedido de cancelamento - Aguardando aprovação';
    reason = trip.cancellationReason || 'Motivo não informado';
    extraInfo = `<p><strong>Solicitado em:</strong> ${fmtDate(trip.cancellationRequestedAt)}</p><p><strong>Status:</strong> Aguardando análise do financeiro</p>`;
  } else if (trip.status === 'cancelada') {
    title = '✅ Viagem cancelada';
    reason = trip.cancellationReason || 'Motivo não informado';
    extraInfo = `<p><strong>Solicitado em:</strong> ${fmtDate(trip.cancellationRequestedAt)}</p><p><strong>Aprovado em:</strong> ${fmtDate(trip.cancellationApprovedAt)}</p><p><strong>Aprovado por:</strong> ${trip.cancellationApprovedBy || 'Financeiro'}</p>`;
  } else if (trip.cancellationRejectionReason) {
    title = '❌ Pedido de cancelamento recusado';
    reason = trip.cancellationReason || 'Motivo não informado';
    extraInfo = `<p><strong>Motivo da recusa do financeiro:</strong> ${trip.cancellationRejectionReason}</p><p><strong>Recusado em:</strong> ${fmtDate(trip.cancellationRejectedAt)}</p>`;
  } else {
    alert('Nenhum motivo de cancelamento encontrado.');
    return;
  }
  
  modal(title, `
    <div style="text-align: center;">
      <div style="font-size: 4rem; margin-bottom: 16px;">📄</div>
      <div class="legal-notice" style="${trip.status === 'cancelada' ? 'background: #e9fff6; border-left-color: var(--success);' : trip.status === 'cancelamento_solicitado' ? 'background: #fff8e6; border-left-color: var(--warning);' : 'background: #fff0f2; border-left-color: var(--danger);'}">
        <strong>${title}</strong>
        <p style="margin-top: 12px; white-space: pre-wrap;"><strong>Motivo informado pelo usuário:</strong><br>${reason}</p>
        ${extraInfo}
      </div>
      <button class="btn btn-primary" onclick="closeModal()">Entendi</button>
    </div>
  `);
}
window.showCancellationReason = showCancellationReason;

function renderFinanceDashboard() {
  const pend = state.trips.filter(t => t.status === 'pendente').length;
  const ass = state.trips.filter(t => t.status === 'aguardando_assinatura').length;
  const extras = state.trips.reduce((a, t) => a + (t.extraFunds || []).filter(x => x.status === 'pendente').length, 0);
  const acerto = state.trips.filter(t => t.status === 'aguardando_acerto').length;
  const signFinance = state.trips.filter(t => t.status === 'aguardando_assinatura_financeiro').length;
  const workQueueTrips = state.trips.filter(t => !['finalizada', 'recusada'].includes(t.status));

  refs.dashboardView.innerHTML = `${sectionHead('Painel do financeiro', 'Aprovação, termos, recursos extras e encerramentos.', `<button class="btn btn-secondary" type="button" onclick="openCompanyModal()">Consultar CNPJs</button>`)}<section class="grid metrics-grid">${renderMetric('Pendentes', pend, '📨')}${renderMetric('Aguardando termo', ass, '✍️')}${renderMetric('Pedido extra', extras, '💵')}${renderMetric('Aguardando acerto', acerto, '🧾')}${renderMetric('Aguardando sua assinatura', signFinance, '✍️')}</section><section class="grid two-col" style="margin-top:16px"><div class="panel"><h4>Fila de trabalho</h4><div class="stack">${workQueueTrips.length ? workQueueTrips.map(financeTripCard).join('') : `<div class="empty">Nenhuma viagem em aberto.</div>`}</div></div><div class="panel"><h4>Ações rápidas</h4><div class="stack"><button class="btn btn-primary" type="button" onclick="goTo('requests')">Abrir solicitações</button><button class="btn btn-secondary" type="button" onclick="goTo('cards')">Cadastrar cartões</button><button class="btn btn-secondary" type="button" onclick="goTo('reports')">Ver PDFs e termos</button></div></div></section>`;
}

function renderFinanceRequests() {
  const list = state.trips.filter(t => !['finalizada', 'recusada'].includes(t.status));
  refs.dashboardView.innerHTML = `${sectionHead('Solicitações e aprovações', 'A viagem só é liberada após o termo assinado ser anexado.')}<section class="panel"><div class="stack">${list.length ? list.map(financeTripCard).join('') : `<div class="empty">Nenhuma solicitação no momento.</div>`}</div></section>`;
}

function renderCards() {
  const inUse = state.trips.filter(t => ['aprovada', 'em_andamento', 'aguardando_acerto', 'aguardando_assinatura_financeiro'].includes(t.status) && Number(t.cardAmount || 0) > 0 && t.cardInUse === true);
  refs.dashboardView.innerHTML = `${sectionHead('Cartões corporativos', 'Cadastre os dados do cartão e acompanhe os cartões em uso.', `<button class="btn btn-primary" type="button" onclick="openCardModal()">+ Novo cartão</button>`)}<section class="grid two-col"><div class="panel"><h4>Cartões cadastrados</h4><div class="stack">${state.cards.length ? state.cards.map(c => `<div class="item-card"><div class="item-top"><div><h5 class="item-title">${c.company} • ${c.brand} • Final ${c.last4}</h5><p class="item-sub">Titular: ${c.holderName}</p></div><div class="pill-inline">${c.active ? 'Ativo' : 'Inativo'}</div></div><div class="small">Validade: ${c.expiry}</div><div class="small">Limite: ${money(c.limit)}</div><div class="actions"><button class="btn btn-secondary" type="button" onclick="editCard(${c.id})">✏️ Editar</button><button class="btn btn-danger" type="button" onclick="deleteCard(${c.id})">🗑️ Excluir</button></div></div>`).join('') : `<div class="empty">Nenhum cartão cadastrado ainda.</div>`}</div></div><div class="panel"><h4>Cartões em uso</h4><div class="stack">${inUse.length ? inUse.map(t => {
    const u = state.users.find(x => x.id === t.userId);
    return `<div class="item-card"><strong class="item-title">${u?.name || '-'} • CPF: ${u?.cpf || '-'} • ${t.company}</strong><p class="item-sub">${fmtDate(t.startDate)} até ${fmtDate(t.endDate)}</p><div class="small">Valor em cartão em uso: ${money(t.cardAmount || 0)}</div><div class="small">Status da viagem: ${t.status}</div></div>`;
  }).join('') : `<div class="empty">Nenhum cartão está sendo usado no momento.</div>`}</div></div></section>`;
}

function renderTechDashboard() {
  const u = currentUser();
  const my = state.trips.filter(t => t.userId === u.id);
  const active = activeTripForUser(u.id);
  const gastosAbertos = active ? tripTotal(active) : 0;

  refs.dashboardView.innerHTML = `${sectionHead('Minha área', 'Painel simples e direto para uso no celular.', `<div class="actions"><button class="btn btn-secondary" type="button" onclick="openCompanyModal()">Ver CNPJs</button>${!active ? `<button class="btn btn-primary" type="button" onclick="openTripModal()">+ Nova viagem</button>` : ''}</div>`)}<section class="grid metrics-grid">${renderMetric('Minhas viagens', my.length, '🧳')}${renderMetric('Viagem aberta', active ? 'Sim' : 'Não', '📍')}${renderMetric('Recursos aprovados', active ? money(totalApprovedResources(active)) : money(0), '💳')}${renderMetric('Gastos lançados (viagem atual)', money(gastosAbertos), '💸')}</section><section class="grid two-col" style="margin-top:16px"><div class="panel"><h4>Viagem atual</h4>${active ? techTripCard(active, true) : `<div class="empty">Você ainda não possui viagem em aberto.</div>`}</div><div class="panel"><h4>Próximos passos</h4><div class="stack"><div class="note">${active ? nextSteps(active) : 'Abra uma nova viagem para iniciar seu processo.'}</div>${active ? `${['aprovada', 'em_andamento'].includes(active.status) ? `<button class="btn btn-primary" type="button" onclick="openExpenseModal(${active.id})">Adicionar gasto</button>` : ''}${['aprovada', 'em_andamento'].includes(active.status) ? `<button class="btn btn-secondary" type="button" onclick="openExtraFundsModal(${active.id})">Solicitar mais dinheiro</button>` : ''}${['aprovada', 'em_andamento'].includes(active.status) ? `<button class="btn btn-secondary" type="button" onclick="openExtensionModal(${active.id})">Pedir dias adicionais</button>` : ''}${['aprovada', 'em_andamento', 'aguardando_acerto'].includes(active.status) ? `<button class="btn btn-warning" type="button" onclick="openFinishWithSignature(${active.id})">Finalizar viagem</button>` : ''}` : ''}</div></div></section>`;
}

function techTripCard(t, expanded = false) {
  const isRejected = t.status === 'recusada';
  const isPendingCancellation = t.status === 'cancelamento_solicitado';
  const isCancelled = t.status === 'cancelada';
  const canRequestCancellation = ['aprovada', 'em_andamento'].includes(t.status) && (!t.expenses || t.expenses.length === 0);
  
  let statusBadge = badge(t.status);
  let statusIcon = '';
  
  if (isPendingCancellation) {
    statusIcon = `<button class="btn btn-ghost" style="padding: 6px 10px;" onclick="showCancellationReason(${t.id})" title="Ver motivo do cancelamento solicitado">📄</button>`;
  } else if (isCancelled) {
    statusIcon = `<button class="btn btn-ghost" style="padding: 6px 10px;" onclick="showCancellationReason(${t.id})" title="Ver motivo do cancelamento">📄</button>`;
  } else if (isRejected) {
    statusIcon = `<button class="btn btn-ghost" style="padding: 6px 10px;" onclick="showRejectionReason(${t.id})" title="Ver motivo da recusa">📄</button>`;
  }
  
  return `<div class="item-card"><div class="item-top"><div><h5 class="item-title">${t.company}</h5><p class="item-sub">${fmtDate(t.startDate)} até ${fmtDate(t.endDate)} • Serviço em ${t.serviceLocation}</p></div><div style="display: flex; align-items: center; gap: 8px;">${statusBadge}${statusIcon}</div></div><div class="stack" style="margin-top:12px"><div class="note">Valor previsto: <strong>${money(t.plannedAmount)}</strong><br>Pagamento aprovado: <strong>${t.paymentTypeLabel || 'Aguardando aprovação'}</strong><br>Cartão: <strong>${money(t.cardAmount || 0)}</strong> • Dinheiro: <strong>${money(t.cashAmount || 0)}</strong><br>Termo de liberação: <strong>${t.releaseTermFile ? 'Anexado' : 'Pendente'}</strong><br>Prazo para acerto com o financeiro: <strong>${t.accountabilityDeadline ? fmtDate(t.accountabilityDeadline) : '-'}</strong> <span class="small">(3 dias úteis)</span><br>${settlementLabel(t)}<br>Dias adicionais aprovados até: <strong>${t.extensionApprovedUntil ? fmtDate(t.extensionApprovedUntil) : 'Sem dias adicionais'}</strong></div>${expanded ? `<div class="row"><div class="note">Recursos aprovados<br><strong>${money(totalApprovedResources(t))}</strong></div><div class="note">Gasto total<br><strong>${money(tripTotal(t))}</strong></div></div><div class="note">${settlementLabel(t)}</div>` : ''}<div class="actions">${canRequestCancellation ? `<button class="btn btn-danger" type="button" onclick="requestTripCancellation(${t.id})">❌ Cancelar viagem</button>` : ''}</div></div></div>`;
}

function renderMyTrips() {
  const u = currentUser();
  const list = state.trips.filter(t => t.userId === u.id);
  refs.dashboardView.innerHTML = `${sectionHead('Minhas viagens', 'Acompanhe cada etapa da sua solicitação.', `${!activeTripForUser(u.id) ? `<button class="btn btn-primary" type="button" onclick="openTripModal()">+ Nova viagem</button>` : ''}`)}<section class="panel"><div class="stack">${list.length ? list.map(t => techTripCard(t)).join('') : `<div class="empty">Nenhuma viagem criada ainda.</div>`}</div></section>`;
}

function viewReceipt(tripId, expenseIndex) {
  const trip = state.trips.find(t => t.id === tripId);
  if (!trip || !trip.expenses[expenseIndex]) {
    alert('Comprovante não encontrado.');
    return;
  }
  const expense = trip.expenses[expenseIndex];
  if (!expense.receiptPreview) {
    alert('Nenhuma imagem disponível para visualização.');
    return;
  }
  modal('Visualizar Comprovante', `
    <div style="text-align: center;">
      <div style="background: linear-gradient(135deg, #f8faff, #f0f5ff); border-radius: 20px; padding: 20px; margin-bottom: 20px;">
        <p style="font-size: 1.2rem; font-weight: 700; color: #0f5ec9; margin: 0 0 8px 0;">${expense.description}</p>
        <p style="margin: 0; color: #647d98;">Valor: <strong style="color: #0ea06f;">${money(expense.amount)}</strong> | Data: ${fmtDate(expense.date)} | Pagamento: ${expense.method}</p>
      </div>
      <div style="background: #f5f7fb; border-radius: 16px; padding: 16px; margin-bottom: 20px;">
        <img src="${expense.receiptPreview}" style="max-width: 100%; max-height: 55vh; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      </div>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <a href="${expense.receiptPreview}" download="${expense.receiptName || 'comprovante'}" class="btn btn-primary">📥 Baixar imagem</a>
        <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
      </div>
    </div>
  `, true);
}
window.viewReceipt = viewReceipt;

function deleteExpense(tripId, expenseIndex) {
  if (!confirm('Tem certeza que deseja excluir este gasto? Esta ação não pode ser desfeita.')) return;
  
  const trip = state.trips.find(t => t.id === tripId);
  if (!trip) {
    alert('Viagem não encontrada.');
    return;
  }
  
  if (!trip.expenses[expenseIndex]) {
    alert('Gasto não encontrado.');
    return;
  }
  
  const deletedExpense = trip.expenses[expenseIndex];
  trip.expenses.splice(expenseIndex, 1);
  
  saveData();
  renderApp();
  alert(`Gasto "${deletedExpense.description}" excluído com sucesso!`);
}
window.deleteExpense = deleteExpense;

function expenseGroupCard(trip) {
  const extras = (trip.extraFunds || []).length ? (trip.extraFunds || []).map(x => `<div class="small">Pedido extra: ${money(x.totalAmount)} • ${x.status}</div>`).join('') : '';
  return `<div class="item-card"><div class="item-top"><div><h5 class="item-title">${trip.company}</h5><p class="item-sub">${fmtDate(trip.startDate)} até ${fmtDate(trip.endDate)} • Total ${money(tripTotal(trip))}</p></div><div>${badge(trip.status)}</div></div><div class="stack" style="margin-top:12px">${(trip.expenses || []).length ? (trip.expenses || []).map((exp, idx) => `<div class="upload-preview"><div class="upload-preview-left">${exp.receiptPreview ? `<img src="${exp.receiptPreview}" style="width:52px;height:52px;object-fit:cover;border-radius:10px;border:1px solid #dbe6f3">` : `<div style="width:52px;height:52px;border-radius:10px;background:#eef6ff;display:grid;place-items:center">🧾</div>`}<div><strong>${exp.description}</strong><br><span class="small">${money(exp.amount)} • ${exp.method} • ${fmtDate(exp.date)}</span><br><span class="small">${exp.receiptName || 'Sem comprovante'}</span></div></div><div class="upload-preview-actions"><button class="action-icon view-icon" onclick="viewReceipt(${trip.id}, ${idx})" title="Visualizar comprovante">🔍</button><button class="action-icon delete-icon" onclick="deleteExpense(${trip.id}, ${idx})" title="Excluir gasto">🗑️</button></div></div>`).join('') : `<div class="small">Nenhum gasto lançado ainda.</div>`}${extras}${['aprovada', 'em_andamento'].includes(trip.status) ? `<div class="actions"><button class="btn btn-primary" type="button" onclick="openExpenseModal(${trip.id})">+ Adicionar gasto</button><button class="btn btn-secondary" type="button" onclick="openExtraFundsModal(${trip.id})">Solicitar mais dinheiro</button></div>` : ''}</div></div>`;
}

function renderExpenses() {
  const u = currentUser();
  // Mostra apenas viagens em andamento ou aprovadas (ativas)
  const list = activeAndApprovedTripsForUser(u.id);
  refs.dashboardView.innerHTML = `${sectionHead('Meus gastos', 'Apenas gastos da viagem atual em andamento.')}<section class="panel"><div class="stack">${list.length ? list.map(expenseGroupCard).join('') : `<div class="empty">Nenhuma viagem em andamento no momento.</div>`}</div></section>`;
}

function renderHistory() {
  const u = currentUser();
  const list = filteredTrips(historyFilters, u.role, u.id);
  refs.dashboardView.innerHTML = `${sectionHead('Histórico', 'Consulte viagens e documentos com filtro por data.')}<section class="panel"><div class="filters"><label>Data inicial<input type="date" id="historyStart" value="${historyFilters.start}" onchange="updateHistoryFilters()"></label><label>Data final<input type="date" id="historyEnd" value="${historyFilters.end}" onchange="updateHistoryFilters()"></label><label>Pesquisar<input id="historyText" value="${historyFilters.text}" onchange="updateHistoryFilters()" placeholder="Empresa, local, id ou usuário..."></label></div><div class="stack">${list.length ? list.map(historyCard).join('') : `<div class="empty">Nenhum resultado encontrado.</div>`}</div></section>`;
}

function historyCard(t) {
  const u = state.users.find(x => x.id === t.userId);
  const isRejected = t.status === 'recusada';
  return `<div class="item-card"><div class="item-top"><div><h5 class="item-title">${t.company}${!isTechLikeRole(currentUser().role) ? ` • ${u?.name || '-'} • CPF: ${u?.cpf || '-'}` : ''}</h5><p class="item-sub">${fmtDate(t.startDate)} até ${fmtDate(t.endDate)} • ${t.serviceLocation}</p></div><div style="display: flex; align-items: center; gap: 8px;">${badge(t.status)}${isRejected ? `<button class="btn btn-ghost" style="padding: 6px 10px;" onclick="showRejectionReason(${t.id})" title="Ver motivo da recusa">📄</button>` : ''}</div></div><div class="small">Previsto: ${money(t.plannedAmount)} • Recursos: ${money(totalApprovedResources(t))} • Gastos: ${money(tripTotal(t))}</div><div class="small">Termo de liberação: ${t.releaseTermGeneratedFile ? t.releaseTermGeneratedFile.name : 'Não gerado'}</div><div class="small">Documento do termo: ${t.releaseTermPhotoFile ? t.releaseTermPhotoFile.name : 'Não anexado'}</div><div class="small">Termo final: ${t.finalTermFile ? t.finalTermFile.name : 'Não anexado'}</div><div class="small">PDF final: ${t.finalReportFile ? t.finalReportFile.name : 'Não gerado'}</div><div class="actions">${t.releaseTermGeneratedFile ? `<button class="btn btn-secondary" type="button" onclick="openReleaseTermPreview(${t.id})">Abrir termo</button>` : ''}${t.releaseTermGeneratedFile ? `<a class="btn btn-ghost" href="${t.releaseTermGeneratedFile.data}" download="${t.releaseTermGeneratedFile.name}">Baixar termo</a>` : ''}</div></div>`;
}

function renderReports() {
  const u = currentUser();
  const list = filteredDocuments(reportFilters, u.role, u.id);
  refs.dashboardView.innerHTML = `${sectionHead('PDFs e documentos assinados', isTechLikeRole(u.role) ? 'Seus relatórios e termos.' : 'Todos os documentos assinados e PDFs ficam disponíveis aqui.')}<section class="panel"><div class="filters"><label>Data inicial<input type="date" id="reportStart" value="${reportFilters.start}" onchange="updateReportFilters()"></label><label>Data final<input type="date" id="reportEnd" value="${reportFilters.end}" onchange="updateReportFilters()"></label><label>Pesquisar<input id="reportText" value="${reportFilters.text}" onchange="updateReportFilters()" placeholder="Título, tipo, arquivo ou usuário..."></label></div><div class="report-list">${list.length ? list.map(documentCard).join('') : `<div class="empty">Nenhum documento encontrado.</div>`}</div></section>`;
}

function documentCard(d) {
  const u = state.users.find(x => x.id === d.userId);
  return `<div class="item-card"><div class="item-top"><div><h5 class="item-title">${d.title}</h5><p class="item-sub">${!isTechLikeRole(currentUser().role) ? `${u?.name || '-'} • CPF: ${u?.cpf || '-'} • ` : ''}${fmtDate(d.docDate)} • ${d.type}</p></div><div class="pill-inline">PDF</div></div><div class="actions"><a class="btn btn-secondary" href="${d.fileData}" download="${d.fileName}">Baixar</a><button class="btn btn-ghost" type="button" onclick="openDocumentSnapshot(${d.id})">Visualizar</button></div></div>`;
}

function updateReportFilters() {
  reportFilters = {
    start: qs('#reportStart')?.value || '',
    end: qs('#reportEnd')?.value || '',
    text: qs('#reportText')?.value || ''
  };
  renderReports();
}
window.updateReportFilters = updateReportFilters;

function updateHistoryFilters() {
  historyFilters = {
    start: qs('#historyStart')?.value || '',
    end: qs('#historyEnd')?.value || '',
    text: qs('#historyText')?.value || ''
  };
  renderHistory();
}
window.updateHistoryFilters = updateHistoryFilters;

function openDocumentSnapshot(id) {
  const d = state.documentIndex.find(x => x.id === id);
  if (!d) return;
  modal('Visualização do documento', `<div class="pdf-preview">${d.snapshotHtml || '<p>Sem prévia disponível.</p>'}</div>`);
}
window.openDocumentSnapshot = openDocumentSnapshot;

function nextSteps(trip) {
  if (trip.status === 'pendente') return 'Sua viagem foi enviada para análise do financeiro.';
  if (trip.status === 'aguardando_assinatura') return 'O financeiro já definiu a liberação. Aguarde o termo assinado ser anexado.';
  if (trip.status === 'aprovada') return 'Viagem liberada. Registre gastos e peça dinheiro extra se precisar.';
  if (trip.status === 'em_andamento') return 'Continue registrando gastos. O prazo de prestação de contas é de até 3 dias após o fim da viagem.';
  if (trip.status === 'aguardando_acerto') return 'Seu relatório final foi enviado. Agora aguarde o financeiro gerar o PDF e anexar o termo final.';
  if (trip.status === 'aguardando_assinatura_financeiro') return 'O financeiro está analisando seu termo final. Aguarde a assinatura dele.';
  if (trip.status === 'finalizada') return 'Processo concluído.';
  return 'Solicitação recusada.';
}

function openUserModal() {
  modal('Cadastrar usuário', `<form class="form" onsubmit="submitUser(event)"><label>Nome completo<input id="userName" required></label><label>E-mail<input id="userEmail" type="email" required></label><label>Senha<input id="userPassword" required></label><label>CPF<input id="userCpf" placeholder="000.000.000-00"></label><label>Perfil<select id="userRole" required><option value="tecnico">Técnico(a)</option><option value="representante">Representante</option><option value="financeiro">Financeiro(a)</option><option value="admin">Administrador(a)</option></select></label><button class="btn btn-primary btn-lg" type="submit">Salvar usuário</button></form>`);
}
window.openUserModal = openUserModal;

function submitUser(ev) {
  ev.preventDefault();
  state.users.push({
    id: nextId(state.users),
    name: qs('#userName').value,
    email: qs('#userEmail').value.trim().toLowerCase(),
    password: qs('#userPassword').value,
    role: qs('#userRole').value,
    photo: '',
    cpf: qs('#userCpf').value || 'Não informado'
  });
  saveData();
  closeModal();
  renderApp();
}
window.submitUser = submitUser;

function changeRole(id, role) {
  const user = state.users.find(u => u.id === id);
  if (!user) return;
  user.role = role;
  saveData();
  renderApp();
}
window.changeRole = changeRole;

function openCompanyModal() {
  const user = currentUser();
  const isAdmin = user?.role === 'admin';

  modal(
    'Empresas e CNPJs',
    `<form class="form" onsubmit="submitCompanies(event)">
      ${state.companies.map(c => `
        <div class="item-card">
          <div style="margin-bottom:10px">
            <strong class="item-title" style="font-size:1.1rem;">🏢 ${c.name}</strong>
          </div>
          <label>CNPJ
            <input id="company-${c.id}" value="${c.cnpj}" ${isAdmin ? 'required' : 'disabled'}>
          </label>
        </div>
      `).join('')}
      ${isAdmin ? `<button class="btn btn-primary btn-lg" type="submit">Salvar CNPJs</button>` : `<div class="note">Somente o administrador pode editar os CNPJs.</div>`}
    </form>`
  );
}
window.openCompanyModal = openCompanyModal;

function submitCompanies(ev) {
  ev.preventDefault();
  const user = currentUser();
  if (user?.role !== 'admin') {
    alert('Somente o administrador pode editar os CNPJs.');
    return;
  }
  state.companies.forEach(c => {
    const input = qs(`#company-${c.id}`);
    if (input) c.cnpj = input.value.trim();
  });
  saveData();
  closeModal();
  renderApp();
}
window.submitCompanies = submitCompanies;

function openCardModal() {
  modal('Novo cartão corporativo', `<form class="form" onsubmit="submitCard(event)"><div class="card-grid"><label>Empresa<select id="cardCompany" required>${state.companies.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}</select></label><label>Nome do titular<input id="cardHolderName" required></label><label>Bandeira<input id="cardBrand" required placeholder="Visa, Master, Elo..."></label><label>Final do cartão<input id="cardLast4" maxlength="4" required></label><label>Validade (MM/AA)<input id="cardExpiry" placeholder="MM/AA" required></label><label>Limite<div class="money-input"><input type="text" id="cardLimitDisplay" class="money-field" data-target="cardLimit" inputmode="numeric" required placeholder="0,00"></div><input type="hidden" id="cardLimit"></label><label>Status<select id="cardActive" required><option value="true">Ativo</option><option value="false">Inativo</option></select></label></div><button class="btn btn-primary btn-lg" type="submit">Salvar cartão</button></form>`);
  setupMoneyFormatting();
  
  const expiryInput = qs('#cardExpiry');
  if (expiryInput) {
    expiryInput.addEventListener('input', function(e) {
      let value = this.value.replace(/\D/g, '');
      if (value.length >= 2) value = value.slice(0, 2) + '/' + value.slice(2, 4);
      this.value = value;
    });
    expiryInput.addEventListener('blur', function() {
      let value = this.value;
      const regex = /^(\d{2})\/(\d{2})$/;
      const match = value.match(regex);
      if (match) {
        let month = match[1];
        let year = match[2];
        const monthNum = parseInt(month, 10);
        if (monthNum >= 1 && monthNum <= 12) {
          this.value = `${month}/${year}`;
        } else {
          this.value = value;
          alert('Mês inválido. Digite um mês entre 01 e 12.');
        }
      } else if (value.length > 0) {
        alert('Formato inválido. Use MM/AA (ex: 10/30)');
      }
    });
  }
}
window.openCardModal = openCardModal;

function editCard(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) {
    alert('Cartão não encontrado.');
    return;
  }
  
  modal('Editar cartão corporativo', `<form class="form" onsubmit="submitEditCard(event, ${cardId})"><div class="card-grid"><label>Empresa<select id="cardCompany" required>${state.companies.map(c => `<option value="${c.name}" ${c.name === card.company ? 'selected' : ''}>${c.name}</option>`).join('')}</select></label><label>Nome do titular<input id="cardHolderName" value="${card.holderName.replace(/"/g, '&quot;')}" required></label><label>Bandeira<input id="cardBrand" value="${card.brand.replace(/"/g, '&quot;')}" required placeholder="Visa, Master, Elo..."></label><label>Final do cartão<input id="cardLast4" maxlength="4" value="${card.last4}" required></label><label>Validade (MM/AA)<input id="cardExpiry" placeholder="MM/AA" value="${card.expiry}" required></label><label>Limite<div class="money-input"><input type="text" id="cardLimitDisplay" class="money-field" data-target="cardLimit" inputmode="numeric" required placeholder="0,00" value="${(card.limit || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}"></div><input type="hidden" id="cardLimit" value="${(card.limit || 0).toFixed(2)}"></label><label>Status<select id="cardActive" required><option value="true" ${card.active ? 'selected' : ''}>Ativo</option><option value="false" ${!card.active ? 'selected' : ''}>Inativo</option></select></label></div><button class="btn btn-primary btn-lg" type="submit">Salvar alterações</button></form>`);
  
  setupMoneyFormatting();
  
  const expiryInput = qs('#cardExpiry');
  if (expiryInput) {
    expiryInput.addEventListener('input', function(e) {
      let value = this.value.replace(/\D/g, '');
      if (value.length >= 2) value = value.slice(0, 2) + '/' + value.slice(2, 4);
      this.value = value;
    });
    expiryInput.addEventListener('blur', function() {
      let value = this.value;
      const regex = /^(\d{2})\/(\d{2})$/;
      const match = value.match(regex);
      if (match) {
        let month = match[1];
        let year = match[2];
        const monthNum = parseInt(month, 10);
        if (monthNum >= 1 && monthNum <= 12) {
          this.value = `${month}/${year}`;
        } else {
          this.value = value;
          alert('Mês inválido. Digite um mês entre 01 e 12.');
        }
      } else if (value.length > 0) {
        alert('Formato inválido. Use MM/AA (ex: 10/30)');
      }
    });
  }
}
window.editCard = editCard;

function submitEditCard(ev, cardId) {
  ev.preventDefault();
  
  const card = state.cards.find(c => c.id === cardId);
  if (!card) {
    alert('Cartão não encontrado.');
    return;
  }
  
  let expiryValue = qs('#cardExpiry').value;
  const regex = /^(\d{2})\/(\d{2})$/;
  const match = expiryValue.match(regex);
  if (!match) {
    alert('Formato de validade inválido. Use MM/AA (ex: 10/30)');
    return;
  }
  
  let month = match[1];
  let year = match[2];
  const monthNum = parseInt(month, 10);
  if (monthNum < 1 || monthNum > 12) {
    alert('Mês inválido. Digite um mês entre 01 e 12.');
    return;
  }
  
  expiryValue = `${month}/${year}`;
  
  // Verifica se o cartão está em uso antes de permitir edição de campos críticos
  const isInUse = state.trips.some(t => t.cardId === cardId && t.cardInUse === true && !['finalizada', 'recusada'].includes(t.status));
  
  if (isInUse) {
    alert('⚠️ Este cartão está em uso em uma viagem ativa. Você só pode editar o status ou o limite. Entre em contato com o usuário antes de desativar o cartão.');
    // Permite apenas editar status e limite se estiver em uso
    const newActive = qs('#cardActive').value === 'true';
    const newLimit = Number(qs('#cardLimit').value || 0);
    card.active = newActive;
    card.limit = newLimit;
  } else {
    // Edição completa permitida
    card.company = qs('#cardCompany').value;
    card.holderName = qs('#cardHolderName').value;
    card.brand = qs('#cardBrand').value;
    card.last4 = qs('#cardLast4').value;
    card.expiry = expiryValue;
    card.limit = Number(qs('#cardLimit').value || 0);
    card.active = qs('#cardActive').value === 'true';
  }
  
  saveData();
  closeModal();
  renderApp();
  alert('Cartão atualizado com sucesso!');
}
window.submitEditCard = submitEditCard;

function deleteCard(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) {
    alert('Cartão não encontrado.');
    return;
  }
  
  // Verifica se o cartão está em uso
  const isInUse = state.trips.some(t => t.cardId === cardId && t.cardInUse === true && !['finalizada', 'recusada'].includes(t.status));
  
  if (isInUse) {
    alert(`❌ Não é possível excluir o cartão "${card.brand} • Final ${card.last4}" porque ele está em uso em uma viagem ativa.`);
    return;
  }
  
  if (confirm(`Deseja excluir o cartão "${card.brand} • Final ${card.last4}" da empresa ${card.company}? Esta ação não pode ser desfeita.`)) {
    const index = state.cards.findIndex(c => c.id === cardId);
    if (index !== -1) {
      state.cards.splice(index, 1);
      saveData();
      renderApp();
      alert('Cartão excluído com sucesso!');
    }
  }
}
window.deleteCard = deleteCard;

function submitCard(ev) {
  ev.preventDefault();
  
  let expiryValue = qs('#cardExpiry').value;
  const regex = /^(\d{2})\/(\d{2})$/;
  const match = expiryValue.match(regex);
  if (!match) {
    alert('Formato de validade inválido. Use MM/AA (ex: 10/30)');
    return;
  }
  
  let month = match[1];
  let year = match[2];
  const monthNum = parseInt(month, 10);
  if (monthNum < 1 || monthNum > 12) {
    alert('Mês inválido. Digite um mês entre 01 e 12.');
    return;
  }
  
  expiryValue = `${month}/${year}`;
  
  state.cards.push({
    id: nextId(state.cards),
    company: qs('#cardCompany').value,
    holderName: qs('#cardHolderName').value,
    brand: qs('#cardBrand').value,
    last4: qs('#cardLast4').value,
    expiry: expiryValue,
    limit: Number(qs('#cardLimit').value || 0),
    active: qs('#cardActive').value === 'true'
  });
  saveData();
  closeModal();
  renderApp();
}
window.submitCard = submitCard;

function openTripModal() {
  const user = currentUser();
  
  // Verifica se existe viagem com cancelamento pendente
  const hasPendingCancellation = state.trips.some(t => t.userId === user.id && t.status === 'cancelamento_solicitado');
  
  if (hasPendingCancellation) {
    alert('❌ Você possui um pedido de cancelamento aguardando aprovação do financeiro. Aguarde a análise antes de abrir uma nova viagem.');
    return;
  }
  
  // Verifica se já tem viagem em andamento
  const hasActiveTrip = activeTripForUser(user.id);
  if (hasActiveTrip) {
    alert('❌ Você já possui uma viagem em andamento. Finalize ou cancele a viagem atual antes de abrir uma nova.');
    return;
  }
  
  modal('Nova viagem', `<form class="form" onsubmit="submitTrip(event)"><div class="card-grid"><label>Empresa<select id="tripCompany" required>${state.companies.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}</select></label><label>Cidade do serviço<input id="tripCity" required placeholder="Ex: São Paulo, Porto Alegre..."></label><label>Cliente<input id="tripServiceLocation" required placeholder="Nome do cliente"></label><label>Data inicial<input id="tripStartDate" type="date" required></label><label>Data final<input id="tripEndDate" type="date" required></label><label>Valor previsto<div class="money-input"><input type="text" id="tripPlannedDisplay" class="money-field" data-target="tripPlannedAmount" inputmode="numeric" required placeholder="0,00"></div><input type="hidden" id="tripPlannedAmount"></label></div><button class="btn btn-primary btn-lg" type="submit">Enviar solicitação para o financeiro</button></form>`);
  setupMoneyFormatting();
  const start = qs('#tripStartDate');
  const end = qs('#tripEndDate');
  start.min = todayISO();
  end.min = todayISO();
  start.addEventListener('change', () => {
    end.min = start.value || todayISO();
    if (end.value && end.value < end.min) end.value = end.min;
  });
}
window.openTripModal = openTripModal;

function requestTripCancellation(tripId) {
  const trip = state.trips.find(t => t.id === tripId);
  if (!trip) {
    alert('Viagem não encontrada.');
    return;
  }
  
  // Verifica se a viagem está em um status que permite cancelamento
  if (!['aprovada', 'em_andamento'].includes(trip.status)) {
    alert('Apenas viagens aprovadas ou em andamento podem ser canceladas.');
    return;
  }
  
  // Verifica se já não há um pedido de cancelamento pendente
  if (trip.status === 'cancelamento_solicitado') {
    alert('Já existe um pedido de cancelamento aguardando aprovação do financeiro.');
    return;
  }
  
  modal('Solicitar cancelamento de viagem', `
    <form class="form" onsubmit="submitCancellationRequest(event, ${tripId})">
      <label>
        Motivo do cancelamento
        <textarea id="cancellationReason" required placeholder="Explique o motivo pelo qual deseja cancelar esta viagem..."></textarea>
      </label>
      <div class="legal-notice" style="background: #fff8e6;">
        <strong>⚠️ Atenção</strong>
        <p>Ao solicitar o cancelamento, você concorda em devolver todos os valores e recursos disponibilizados. O financeiro irá analisar seu pedido.</p>
      </div>
      <button class="btn btn-warning btn-lg" type="submit">Solicitar cancelamento</button>
    </form>
  `);
}
window.requestTripCancellation = requestTripCancellation;

function submitCancellationRequest(ev, tripId) {
  ev.preventDefault();
  
  const trip = state.trips.find(t => t.id === tripId);
  if (!trip) return;
  
  const cancellationReason = qs('#cancellationReason').value;
  if (!cancellationReason.trim()) {
    alert('Por favor, informe o motivo do cancelamento.');
    return;
  }
  
  trip.cancellationReason = cancellationReason;
  trip.cancellationRequestedAt = todayISO();
  trip.status = 'cancelamento_solicitado';
  
  saveData();
  closeModal();
  renderApp();
  alert('✅ Pedido de cancelamento enviado ao financeiro para aprovação.');
}
window.submitCancellationRequest = submitCancellationRequest;

function approveCancellation(tripId) {
  const trip = state.trips.find(t => t.id === tripId);
  if (!trip) return;
  
  if (confirm(`Deseja APROVAR o cancelamento da viagem de ${trip.serviceLocation}?\n\nMotivo: ${trip.cancellationReason}\n\nO cartão será liberado e o usuário poderá abrir uma nova viagem.`)) {
    // Libera o cartão se estiver em uso
    if (trip.cardInUse) {
      trip.cardInUse = false;
    }
    trip.status = 'cancelada';
    trip.cancellationApprovedAt = todayISO();
    trip.cancellationApprovedBy = currentUser()?.name || 'Financeiro';
    
    saveData();
    renderApp();
    alert('✅ Cancelamento aprovado! O usuário agora pode abrir uma nova viagem.');
  }
}
window.approveCancellation = approveCancellation;

function rejectCancellation(tripId) {
  const trip = state.trips.find(t => t.id === tripId);
  if (!trip) return;
  
  modal('Recusar pedido de cancelamento', `
    <form class="form" onsubmit="submitRejectCancellation(event, ${tripId})">
      <div class="legal-notice" style="background: #fff0f2; border-left-color: var(--danger); margin-bottom: 16px;">
        <strong>Motivo do cancelamento solicitado pelo usuário:</strong>
        <p style="margin-top: 8px; white-space: pre-wrap;">${trip.cancellationReason || 'Não informado'}</p>
      </div>
      <label>
        Motivo da recusa do cancelamento
        <textarea id="rejectionReason" required placeholder="Explique o motivo pelo qual o cancelamento está sendo recusado..."></textarea>
      </label>
      <button class="btn btn-danger btn-lg" type="submit">Recusar cancelamento</button>
    </form>
  `);
}
window.rejectCancellation = rejectCancellation;

function submitRejectCancellation(ev, tripId) {
  ev.preventDefault();
  
  const trip = state.trips.find(t => t.id === tripId);
  if (!trip) return;
  
  const rejectionReason = qs('#rejectionReason').value;
  if (!rejectionReason.trim()) {
    alert('Por favor, informe o motivo da recusa.');
    return;
  }
  
  trip.cancellationRejectionReason = rejectionReason;
  trip.status = trip.cardInUse ? 'em_andamento' : 'aprovada'; // Volta ao status anterior
  trip.cancellationRejectedAt = todayISO();
  
  saveData();
  closeModal();
  renderApp();
  alert('❌ Cancelamento recusado. A viagem continua ativa.');
}
window.submitRejectCancellation = submitRejectCancellation;

function submitTrip(ev) {
  ev.preventDefault();
  const user = currentUser();
  const city = qs('#tripCity').value;
  const cliente = qs('#tripServiceLocation').value;
  const fullServiceLocation = `${city} - ${cliente}`;
  
  state.trips.push({
    id: nextId(state.trips),
    userId: user.id,
    company: qs('#tripCompany').value,
    city: city,
    serviceLocationDetail: cliente,
    serviceLocation: fullServiceLocation,
    startDate: qs('#tripStartDate').value,
    endDate: qs('#tripEndDate').value,
    plannedAmount: Number(qs('#tripPlannedAmount').value || 0),
    paymentType: '',
    paymentTypeLabel: '',
    cardAmount: 0,
    cashAmount: 0,
    cardId: null,
    cardInUse: false,
    expenses: [],
    extraFunds: [],
    status: 'pendente',
    accountabilityDeadline: '',
    extensionRequestedUntil: '',
    extensionApprovedUntil: '',
    extensionReason: '',
    releaseTermFile: null,
    releaseTermGeneratedFile: null,
    releaseTermPhotoFile: null,
    releaseTermGeneratedAt: null,
    finalTermFile: null,
    finalReportFile: null,
    userSignature: null,
    userSignatureDate: null,
    financeSignature: null,
    financeSignatureDate: null,
    createdAt: new Date().toISOString()
  });
  saveData();
  closeModal();
  currentView = 'myTrips';
  renderApp();
}
window.submitTrip = submitTrip;

function openApproveModal(id, type) {
  const trip = state.trips.find(t => t.id === id);
  if (!trip) return;

  const availableCards = state.cards.filter(c => c.company === trip.company && c.active === true);
  const cardsInUse = state.trips.filter(t => t.id !== id && t.cardInUse === true && t.company === trip.company).map(t => t.cardId);
  const freeCards = availableCards.filter(c => !cardsInUse.includes(c.id));
  const labelMap = { cartao: 'Cartão', dinheiro: 'Dinheiro', misto: 'Misto' };

  let cardSelectHtml = '';
  if (type !== 'dinheiro' && freeCards.length > 0) {
    cardSelectHtml = `<label>Selecionar cartão<select id="approvalCardSelect" required>
      ${freeCards.map(c => `<option value="${c.id}" data-limit="${c.limit}" data-brand="${c.brand}" data-last4="${c.last4}">${c.brand} • Final ${c.last4} • Limite: ${money(c.limit)}</option>`).join('')}
    </select></label>`;
  } else if (type !== 'dinheiro' && freeCards.length === 0 && availableCards.length > 0) {
    cardSelectHtml = `<div class="note" style="background:#fff0f2;color:#c93c55;margin-bottom:12px;">⚠️ Todos os cartões da empresa ${trip.company} estão em uso no momento. Não é possível liberar com cartão agora.</div>`;
  } else if (type !== 'dinheiro' && availableCards.length === 0) {
    cardSelectHtml = `<div class="note" style="background:#fff0f2;color:#c93c55;margin-bottom:12px;">⚠️ Não há cartão ativo cadastrado para ${trip.company}. Não é possível liberar com cartão.</div>`;
  }

  modal('Aprovar solicitação', `<form class="form" onsubmit="submitApproval(event, ${id}, '${type}')">
    <div class="note">Tipo de liberação: <strong>${labelMap[type]}</strong></div>
    ${cardSelectHtml}
    <div class="card-grid">
      ${type !== 'dinheiro' && freeCards.length > 0 ? `<label>Valor no cartão<div class="money-input"><input type="text" id="approvalCardDisplay" class="money-field" data-target="approvalCard" inputmode="numeric" placeholder="0,00" required></div><input type="hidden" id="approvalCard"></label>` : ''}
      ${type !== 'cartao' ? `<label>Valor em dinheiro<div class="money-input"><input type="text" id="approvalCashDisplay" class="money-field" data-target="approvalCash" inputmode="numeric" placeholder="0,00" ${type === 'dinheiro' ? 'required' : ''}></div><input type="hidden" id="approvalCash"></label>` : ''}
    </div>
    <button class="btn btn-primary btn-lg" type="submit">Confirmar aprovação</button>
  </form>`);

  setupMoneyFormatting();
  
  if (type !== 'dinheiro' && freeCards.length > 0) {
    const cardSelect = qs('#approvalCardSelect');
    const cardInput = qs('#approvalCardDisplay');
    
    const updateCardLimit = () => {
      const selectedOption = cardSelect.options[cardSelect.selectedIndex];
      const limit = Number(selectedOption.dataset.limit || 0);
      cardInput.dataset.max = limit;
      cardInput.value = limit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const hidden = qs('#approvalCard');
      if (hidden) hidden.value = limit.toFixed(2);
    };
    
    cardSelect.addEventListener('change', updateCardLimit);
    updateCardLimit();
    
    cardInput.addEventListener('input', function() {
      const maxLimit = parseFloat(this.dataset.max) || 0;
      const rawValue = this.value.replace(/\D/g, '');
      let numericValue = Number(rawValue || 0) / 100;
      if (maxLimit > 0 && numericValue > maxLimit) {
        numericValue = maxLimit;
        this.value = numericValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      const hidden = qs('#approvalCard');
      if (hidden) hidden.value = numericValue.toFixed(2);
    });
  }
}
window.openApproveModal = openApproveModal;

function submitApproval(ev, id, type) {
  ev.preventDefault();
  const trip = state.trips.find(t => t.id === id);
  if (!trip) return;

  let cardAmount = 0;
  let selectedCardId = null;
  
  if (type !== 'dinheiro') {
    const cardSelect = qs('#approvalCardSelect');
    if (cardSelect && cardSelect.value) {
      selectedCardId = parseInt(cardSelect.value);
      const selectedCard = state.cards.find(c => c.id === selectedCardId);
      if (selectedCard) {
        cardAmount = Number(qs('#approvalCard')?.value || 0);
        if (cardAmount > selectedCard.limit) {
          alert(`O valor no cartão (${money(cardAmount)}) excede o limite disponível do cartão selecionado (${money(selectedCard.limit)}).`);
          return;
        }
      }
    }
  }
  
  const cashAmount = Number(qs('#approvalCash')?.value || 0);

  if (type === 'cartao' && cardAmount === 0) {
    alert('Informe o valor a ser liberado no cartão.');
    return;
  }
  if (type === 'dinheiro' && cashAmount === 0) {
    alert('Informe o valor a ser liberado em dinheiro.');
    return;
  }
  if (type === 'misto' && cardAmount === 0 && cashAmount === 0) {
    alert('Informe pelo menos um valor para liberação mista.');
    return;
  }

  trip.paymentType = type;
  trip.paymentTypeLabel = type === 'cartao' ? 'Cartão corporativo' : type === 'dinheiro' ? 'Dinheiro' : 'Misto';
  trip.cardAmount = cardAmount;
  trip.cashAmount = cashAmount;
  trip.cardId = selectedCardId;
  if (cardAmount > 0) trip.cardInUse = true;
  trip.status = 'aguardando_assinatura';

  const user = state.users.find(u => u.id === trip.userId);
  const releaseDoc = generateReleaseDeliveryPdf(trip, user);
  const releaseFileName = `termo_liberacao_viagem_${trip.id}.pdf`;
  const releaseBlob = releaseDoc.output('blob');
  blobToDataURL(releaseBlob).then(releasePdfData => {
    trip.releaseTermGeneratedFile = { name: releaseFileName, data: releasePdfData };
    trip.releaseTermGeneratedAt = todayISO();
    upsertDocument(
      d => d.tripId === trip.id && d.type === 'Termo de liberação',
      {
        userId: trip.userId,
        tripId: trip.id,
        title: `Termo de liberação - ${trip.serviceLocation}`,
        type: 'Termo de liberação',
        fileName: releaseFileName,
        fileData: releasePdfData,
        docDate: todayISO(),
        snapshotHtml: buildReleaseTermSnapshot(trip, user)
      }
    );
    saveData();
    closeModal();
    renderApp();
  });
}
window.submitApproval = submitApproval;

function rejectTrip(id) {
  const trip = state.trips.find(t => t.id === id);
  if (!trip) return;
  
  modal('Recusar solicitação de viagem', `
    <form class="form" onsubmit="submitRejectTrip(event, ${id})">
      <label>
        Motivo da recusa
        <textarea id="rejectionReason" required placeholder="Explique o motivo pelo qual esta viagem está sendo recusada..."></textarea>
      </label>
      <div class="note" style="margin-top: 8px;">
        ⚠️ O usuário receberá esta explicação como justificativa da recusa.
      </div>
      <button class="btn btn-danger btn-lg" type="submit">Confirmar recusa</button>
    </form>
  `);
}
window.rejectTrip = rejectTrip;

function submitRejectTrip(ev, id) {
  ev.preventDefault();
  const trip = state.trips.find(t => t.id === id);
  if (!trip) return;
  
  const rejectionReason = qs('#rejectionReason').value;
  if (!rejectionReason.trim()) {
    alert('Por favor, informe o motivo da recusa.');
    return;
  }
  
  if (trip.cardInUse) trip.cardInUse = false;
  trip.status = 'recusada';
  trip.rejectionReason = rejectionReason;
  
  saveData();
  closeModal();
  renderApp();
  alert('Viagem recusada com sucesso!');
}
window.submitRejectTrip = submitRejectTrip;

function openReleaseTermModal(id) {
  const trip = state.trips.find(t => t.id === id);
  if (!trip) return;
  const user = state.users.find(u => u.id === trip.userId);
  const downloadBtn = trip.releaseTermGeneratedFile
    ? `<a class="btn btn-secondary" href="${trip.releaseTermGeneratedFile.data}" download="${trip.releaseTermGeneratedFile.name}">Baixar termo em PDF</a>`
    : '';
    
  modal('Termo de liberação e anexo do documento assinado', `
    <form class="form" id="releaseTermForm" onsubmit="submitReleaseTerm(event, ${id})">
      <div class="pdf-preview" style="max-height: 300px; overflow-y: auto;">
        ${buildReleaseTermSnapshot(trip, user)}
      </div>
      <div class="actions" style="margin-top:12px; margin-bottom:8px;">
        ${downloadBtn}
        <button class="btn btn-ghost" type="button" onclick="openReleaseTermPreview(${id})">Visualizar termo</button>
      </div>
      <label>
        Anexar documento do termo assinado por ambas as partes (PDF, imagem, etc.)
        <input id="releaseTermFile" type="file" accept="*/*" required>
      </label>
      <button id="submitReleaseTermBtn" class="btn btn-primary btn-lg" type="submit">Salvar termo e liberar viagem</button>
    </form>
  `);
}

async function submitReleaseTerm(ev, id) {
  ev.preventDefault();
  
  const trip = state.trips.find(t => t.id === id);
  const fileInput = document.getElementById('releaseTermFile');
  const submitBtn = document.getElementById('submitReleaseTermBtn');
  
  if (!trip) {
    alert('Viagem não encontrada.');
    return;
  }
  
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    alert('Anexe o documento do termo assinado para liberar a viagem.');
    return;
  }
  
  const file = fileInput.files[0];
  
  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Salvando...';
    }
    
    const fileData = await fileToData(file);
    
    trip.releaseTermFile = { name: file.name, data: fileData };
    trip.releaseTermPhotoFile = { name: file.name, data: fileData };
    trip.status = 'aprovada';
    trip.accountabilityDeadline = addBusinessDaysISO(trip.endDate, 3);

    const user = state.users.find(u => u.id === trip.userId);
    
    upsertDocument(
      d => d.tripId === trip.id && d.type === 'Termo de liberação',
      {
        userId: trip.userId,
        tripId: trip.id,
        title: `Termo de liberação - ${trip.serviceLocation}`,
        type: 'Termo de liberação',
        fileName: trip.releaseTermGeneratedFile?.name || `termo_liberacao_viagem_${trip.id}.pdf`,
        fileData: trip.releaseTermGeneratedFile?.data || fileData,
        docDate: todayISO(),
        snapshotHtml: buildReleaseTermSnapshot(trip, user)
      }
    );

    saveData();
    closeModal();
    renderApp();
    alert('✅ Termo salvo e viagem liberada com sucesso!');
    
  } catch (error) {
    console.error('Erro ao salvar termo:', error);
    alert('❌ Ocorreu um erro ao salvar o termo: ' + error.message);
    
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Salvar termo e liberar viagem';
    }
  }
}
window.submitReleaseTerm = submitReleaseTerm;

function openExpenseModal(id) {
  modal('Adicionar gasto', `<form class="form" onsubmit="submitExpense(event, ${id})"><div class="card-grid"><label>Descrição<input id="expenseDescription" required></label><label>Data<input id="expenseDate" type="date" required value="${todayISO()}"></label><label>Valor<div class="money-input"><input type="text" id="expenseAmountDisplay" class="money-field" data-target="expenseAmount" inputmode="numeric" required placeholder="0,00"></div><input type="hidden" id="expenseAmount"></label><label>Forma de pagamento<select id="expenseMethod" required><option value="Cartão corporativo">Cartão corporativo</option><option value="Dinheiro">Dinheiro</option><option value="Pessoal">Pessoal</option></select></label></div><label>Comprovante (obrigatório)<input id="expenseReceipt" type="file" accept=".pdf,image/*" required></label><button class="btn btn-primary btn-lg" type="submit">Salvar gasto</button></form>`);
  setupMoneyFormatting();
}
window.openExpenseModal = openExpenseModal;

async function submitExpense(ev, id) {
  ev.preventDefault();
  const trip = state.trips.find(t => t.id === id);
  if (!trip) {
    alert('Viagem não encontrada.');
    return;
  }
  const file = qs('#expenseReceipt').files[0];
  if (!file) {
    alert('O comprovante é obrigatório!');
    return;
  }
  if (!Array.isArray(trip.expenses)) trip.expenses = [];
  const preview = await fileToData(file);
  const name = file.name;
  
  const description = qs('#expenseDescription').value;
  const date = qs('#expenseDate').value;
  const amount = Number(qs('#expenseAmount').value || 0);
  const method = qs('#expenseMethod').value;
  
  if (!description || !date || !amount || amount <= 0) {
    alert('Preencha todos os campos corretamente!');
    return;
  }
  
  trip.expenses.push({
    id: Date.now(),
    description: description,
    date: date,
    amount: amount,
    method: method,
    receiptPreview: preview,
    receiptName: name
  });
  if (trip.status === 'aprovada') trip.status = 'em_andamento';
  saveData();
  closeModal();
  renderApp();
  alert('Gasto adicionado com sucesso!');
}
window.submitExpense = submitExpense;

function openExtraFundsModal(id) {
  modal('Solicitar mais dinheiro', `<form class="form" onsubmit="submitExtraFunds(event, ${id})"><label>Valor solicitado<div class="money-input"><input type="text" id="extraAmountDisplay" class="money-field" data-target="extraAmount" inputmode="numeric" required placeholder="0,00"></div><input type="hidden" id="extraAmount"></label><label>Motivo<textarea id="extraReason" required></textarea></label><button class="btn btn-primary btn-lg" type="submit">Enviar pedido extra</button></form>`);
  setupMoneyFormatting();
}
window.openExtraFundsModal = openExtraFundsModal;

function submitExtraFunds(ev, id) {
  ev.preventDefault();
  const trip = state.trips.find(t => t.id === id);
  if (!trip) return;
  trip.extraFunds = trip.extraFunds || [];
  trip.extraFunds.push({
    id: Date.now(),
    totalAmount: Number(qs('#extraAmount').value || 0),
    reason: qs('#extraReason').value,
    status: 'pendente'
  });
  saveData();
  closeModal();
  renderApp();
}
window.submitExtraFunds = submitExtraFunds;

function openExtraFundsApprovalModal(id) {
  const trip = state.trips.find(t => t.id === id);
  if (!trip) return;
  const pending = (trip.extraFunds || []).filter(x => x.status === 'pendente');
  modal('Analisar pedido extra', `<div class="stack">${pending.map(item => `<div class="item-card"><div class="small">Valor: <strong>${money(item.totalAmount)}</strong></div><div class="small">Motivo: ${item.reason}</div><div class="actions"><button class="btn btn-success" type="button" onclick="approveExtraFunds(${id}, ${item.id})">Aprovar</button><button class="btn btn-danger" type="button" onclick="rejectExtraFunds(${id}, ${item.id})">Recusar</button></div></div>`).join('')}</div>`);
}
window.openExtraFundsApprovalModal = openExtraFundsApprovalModal;

function approveExtraFunds(tripId, extraId) {
  const trip = state.trips.find(t => t.id === tripId);
  const extra = trip?.extraFunds?.find(x => x.id === extraId);
  if (!extra) return;
  extra.status = 'aprovado';
  saveData();
  closeModal();
  renderApp();
}
window.approveExtraFunds = approveExtraFunds;

function rejectExtraFunds(tripId, extraId) {
  const trip = state.trips.find(t => t.id === tripId);
  const extra = trip?.extraFunds?.find(x => x.id === extraId);
  if (!extra) return;
  extra.status = 'recusado';
  saveData();
  closeModal();
  renderApp();
}
window.rejectExtraFunds = rejectExtraFunds;

function openExtensionModal(id) {
  modal('Pedir dias adicionais', `<form class="form" onsubmit="submitExtension(event, ${id})"><label>Nova data final desejada<input id="extensionDate" type="date" required></label><label>Motivo<textarea id="extensionReason" required></textarea></label><button class="btn btn-primary btn-lg" type="submit">Enviar pedido</button></form>`);
  qs('#extensionDate').min = todayISO();
}
window.openExtensionModal = openExtensionModal;

function submitExtension(ev, id) {
  ev.preventDefault();
  const trip = state.trips.find(t => t.id === id);
  if (!trip) return;
  trip.extensionRequestedUntil = qs('#extensionDate').value;
  trip.extensionReason = qs('#extensionReason').value;
  saveData();
  closeModal();
  renderApp();
}
window.submitExtension = submitExtension;

function approveExtension(id) {
  const trip = state.trips.find(t => t.id === id);
  if (!trip || !trip.extensionRequestedUntil) return;
  trip.extensionApprovedUntil = trip.extensionRequestedUntil;
  trip.endDate = trip.extensionRequestedUntil;
  trip.accountabilityDeadline = addBusinessDaysISO(trip.endDate, 3);
  saveData();
  renderApp();
}
window.approveExtension = approveExtension;

function openFinishWithSignature(id) {
  const trip = state.trips.find(t => t.id === id);
  if (!trip) {
    alert('Viagem não encontrada. Tente novamente.');
    return;
  }
  
  pendingSignatureTripId = id;
  
  modal('Finalizar viagem - Assinatura eletrônica', `
    <form class="form" onsubmit="submitFinishWithSignature(event)">
      <div class="legal-notice">
        <strong>📋 TERMO DE RESPONSABILIDADE</strong>
        <p>Declaro que todas as despesas lançadas nesta viagem são legítimas, ocorreram durante o período da viagem e estão devidamente comprovadas com recibos e notas fiscais anexadas.</p>
        <p>Estou ciente que:<br>
        • Qualquer gasto não comprovado será descontado em folha<br>
        • O uso indevido do cartão corporativo acarretará em medidas administrativas e legais<br>
        • A empresa poderá solicitar documentos adicionais para comprovação dos gastos<br>
        • Este termo tem validade legal e poderá ser utilizado em processos judiciais<br>
        • Falsificar informações constitui crime previsto no Art. 299 do Código Penal</p>
        <p><strong>Os documentos e comprovantes deverão ser armazenados por no mínimo 30 (trinta) dias após a assinatura de ambas as partes.</strong></p>
      </div>
      
      <label>ASSINATURA ELETRÔNICA (usuário)</label>
      <div class="signature-pad-container">
        <canvas id="userSignatureCanvas" class="signature-canvas" style="touch-action: none;"></canvas>
        <div class="signature-actions">
          <button type="button" class="btn btn-secondary" id="clearUserSignature">Limpar</button>
        </div>
        <div class="signature-info">Assine acima usando o mouse ou toque na tela</div>
      </div>
      
      <button class="btn btn-warning btn-lg" type="submit">Assinar e enviar para o financeiro</button>
    </form>
  `);
  
  setTimeout(() => {
    signaturePad = initSignaturePad('#userSignatureCanvas', '#clearUserSignature');
  }, 100);
}
window.openFinishWithSignature = openFinishWithSignature;

async function submitFinishWithSignature(ev) {
  ev.preventDefault();

  if (!signaturePad || signaturePad.isEmpty()) {
    alert('Você precisa assinar o documento antes de finalizar!');
    return;
  }

  const trip = state.trips.find(t => t.id === pendingSignatureTripId);
  if (!trip) {
    alert('Viagem não encontrada. Por favor, tente novamente.');
    return;
  }

  try {
    const signatureData = signaturePad.toDataURL();
    trip.userSignature = signatureData;
    trip.userSignatureDate = todayISO();
    trip.status = 'aguardando_assinatura_financeiro';

    const user = state.users.find(u => u.id === trip.userId);
    const fileName = `termo_final_viagem_${trip.id}_usuario.pdf`;
    let pdfDataUrl = '';

    try {
      const doc = generateFullTermPdf(trip, user);
      const pdfBlob = doc.output('blob');
      pdfDataUrl = await blobToDataURL(pdfBlob);
    } catch (pdfError) {
      console.error('Erro ao gerar PDF final do usuário:', pdfError);
      pdfDataUrl = '';
    }

    trip.pendingTermFile = pdfDataUrl ? { name: fileName, data: pdfDataUrl } : null;

    upsertDocument(
      d => d.tripId === trip.id && d.type === 'Termo final aguardando assinatura',
      {
        userId: trip.userId,
        tripId: trip.id,
        title: `Termo final - ${trip.serviceLocation}`,
        type: 'Termo final aguardando assinatura',
        fileName,
        fileData: pdfDataUrl || '',
        docDate: todayISO(),
        snapshotHtml: buildFullTermSnapshot(trip, user, null)
      }
    );

    saveData();
    closeModal();
    renderApp();
    alert('Termo assinado e enviado ao financeiro com sucesso.');
  } catch (error) {
    console.error(error);
    alert('Não foi possível enviar o termo final da viagem.');
  }
}
window.submitFinishWithSignature = submitFinishWithSignature;

function viewPendingSignature(id) {
  const trip = state.trips.find(t => t.id === id);
  if (!trip || !trip.userSignature) {
    alert('Nenhum termo pendente para assinatura.');
    return;
  }
  
  const user = state.users.find(u => u.id === trip.userId);
  
  modal('Visualizar termo do usuário', `
    <div class="actions" style="margin-bottom: 12px;">
      ${trip.pendingTermFile ? `<a class="btn btn-secondary" href="${trip.pendingTermFile.data}" download="${trip.pendingTermFile.name}">Baixar PDF enviado</a>` : ''}
    </div>
    <div class="pdf-preview">
      ${buildFullTermSnapshot(trip, user, null)}
      <div class="signature-preview" style="margin-top: 16px; padding: 16px; background: #f8faff; border-radius: 12px;">
        <p><strong>✅ Assinatura do(a) colaborador(a) (já realizada):</strong></p>
        <img src="${trip.userSignature}" style="max-width: 300px; border: 1px solid #ccc; border-radius: 8px; background: white;">
        <p class="small" style="margin-top: 8px;">Assinado eletronicamente em: ${fmtDate(trip.userSignatureDate)}</p>
      </div>
      <div class="actions" style="margin-top: 20px;">
        <button class="btn btn-success" onclick="openFinanceSignature(${id})">Assinar como financeiro</button>
        <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
      </div>
    </div>
  `);
}
window.viewPendingSignature = viewPendingSignature;

function openFinanceSignature(id) {
  const trip = state.trips.find(t => t.id === id);
  if (!trip) return;

  pendingSignatureForFinance = id;
  const user = state.users.find(u => u.id === trip.userId);

  modal('Assinatura do financeiro', `
    <form class="form" onsubmit="submitFinanceSignature(event)">
      <div class="pdf-preview" style="max-height: 400px; overflow-y: auto;">
        ${buildFullTermSnapshot(trip, user, null)}
      </div>

      <div class="signature-preview" style="margin: 16px 0; padding: 16px; background: #f8faff; border-radius: 12px;">
        <p><strong>✅ Assinatura do(a) colaborador(a) (já realizada):</strong></p>
        <img src="${trip.userSignature}" style="max-width: 280px; border: 1px solid #ccc; border-radius: 8px; background: white;">
        <p class="small" style="margin-top: 8px;">Assinado eletronicamente em: ${fmtDate(trip.userSignatureDate)}</p>
      </div>

      <div style="border-top: 2px solid var(--line); margin: 16px 0;"></div>

      <label><strong>✍️ ASSINATURA ELETRÔNICA (financeiro)</strong></label>
      <div class="signature-pad-container">
        <canvas id="financeSignatureCanvas" class="signature-canvas" style="touch-action: none;"></canvas>
        <div class="signature-actions">
          <button type="button" class="btn btn-secondary" id="clearFinanceSignature">Limpar</button>
        </div>
        <div class="signature-info">Assine acima usando o mouse ou toque na tela</div>
      </div>

      <button class="btn btn-primary btn-lg" type="submit">Assinar e finalizar viagem</button>
    </form>
  `);

  setTimeout(() => {
    signaturePad = initSignaturePad('#financeSignatureCanvas', '#clearFinanceSignature');
  }, 100);
}
window.openFinanceSignature = openFinanceSignature;

async function submitFinanceSignature(ev) {
  ev.preventDefault();

  if (!signaturePad || signaturePad.isEmpty()) {
    alert('Você precisa assinar o documento para finalizar!');
    return;
  }

  const trip = state.trips.find(t => t.id === pendingSignatureForFinance);
  if (!trip) {
    alert('Viagem não encontrada.');
    return;
  }

  try {
    const signatureData = signaturePad.toDataURL();
    trip.financeSignature = signatureData;
    trip.financeSignatureDate = todayISO();

    const user = state.users.find(u => u.id === trip.userId);
    const finalTermDoc = generateCompleteFinalPdf(trip, user);
    const finalTermFileName = `termo_final_assinado_viagem_${trip.id}.pdf`;
    const finalTermBlob = finalTermDoc.output('blob');
    const finalTermDataUrl = await blobToDataURL(finalTermBlob);

    trip.finalTermFile = { name: finalTermFileName, data: finalTermDataUrl };
    trip.finalReportFile = { name: finalTermFileName, data: finalTermDataUrl };
    trip.cardInUse = false;
    trip.status = 'finalizada';

    upsertDocument(
      d => d.tripId === trip.id && d.type === 'Termo final aguardando assinatura',
      {
        userId: trip.userId,
        tripId: trip.id,
        title: `Termo final - ${trip.serviceLocation}`,
        type: 'Termo final assinado',
        fileName: finalTermFileName,
        fileData: finalTermDataUrl,
        docDate: todayISO(),
        snapshotHtml: buildCompleteFinalSnapshot(trip, user)
      }
    );

    upsertDocument(
      d => d.tripId === trip.id && d.type === 'PDF final',
      {
        userId: trip.userId,
        tripId: trip.id,
        title: `Prestação final - ${trip.serviceLocation}`,
        type: 'PDF final',
        fileName: finalTermFileName,
        fileData: finalTermDataUrl,
        docDate: todayISO(),
        snapshotHtml: buildCompleteFinalSnapshot(trip, user)
      }
    );

    saveData();
    closeModal();
    renderApp();
    alert('Viagem finalizada com sucesso!');
  } catch (error) {
    console.error(error);
    alert('Não foi possível finalizar a viagem.');
  }
}
window.submitFinanceSignature = submitFinanceSignature;

function generateFullTermPdf(trip, user) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 18;
  const saldo = settlementAmount(trip);
  const company = getCompanyByTrip(trip);
  const dataExtenso = formatDateExtended();
  const financeiroUser = currentUser();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('DeltaSoft - TERMO FINAL DE PRESTAÇÃO DE CONTAS', 14, y);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  [
    tripLabel(trip),
    `Colaborador(a): ${user?.name || '-'} • CPF: ${user?.cpf || 'Não informado'}`,
    `Financeiro(a): ${financeiroUser?.name || '-'} • CPF: ${financeiroUser?.cpf || 'Não informado'}`,
    `Empresa: ${company.name} • CNPJ: ${company.cnpj}`,
    `Período: ${fmtDate(trip.startDate)} até ${fmtDate(trip.endDate)}`,
    `Local do serviço: ${trip.serviceLocation}`,
    `Prazo para acerto com o financeiro: ${fmtDate(trip.accountabilityDeadline)} (3 dias úteis)`
  ].forEach(line => { doc.text(line, 14, y); y += 7; });

  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMO FINANCEIRO', 14, y); y += 7;
  doc.setFont('helvetica', 'normal');
  [
    `Valor previsto: ${money(trip.plannedAmount)}`,
    `Forma de liberação: ${trip.paymentTypeLabel || '-'}`,
    `Valor liberado em cartão: ${money(trip.cardAmount || 0)}`,
    `Valor liberado em dinheiro: ${money(trip.cashAmount || 0)}`,
    `Total liberado ao(à) colaborador(a): ${money(Number(trip.cardAmount || 0) + Number(trip.cashAmount || 0))}`,
    `Extras aprovados: ${money((trip.extraFunds || []).filter(x => x.status === 'aprovado').reduce((a, b) => a + Number(b.totalAmount || 0), 0))}`,
    `Total de recursos: ${money(totalApprovedResources(trip))}`,
    `Total de gastos: ${money(tripTotal(trip))}`,
    `${saldo >= 0 ? 'Valor a devolver pelo(a) usuário(a)' : 'Valor a receber de volta pelo(a) usuário(a)'}: ${money(Math.abs(saldo))}`
  ].forEach(line => { doc.text(line, 14, y); y += 7; });

  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.text('DETALHAMENTO DOS GASTOS', 14, y); y += 7;
  doc.setFont('helvetica', 'normal');

  if ((trip.expenses || []).length) {
    trip.expenses.forEach((exp, index) => {
      if (y > 240) { doc.addPage(); y = 18; }
      const lines = doc.splitTextToSize(`${index + 1}. ${exp.description} | ${fmtDate(exp.date)} | ${money(exp.amount)} | ${exp.method}`, 180);
      doc.text(lines, 14, y);
      y += lines.length * 6;
      const proof = doc.splitTextToSize(`Comprovante: ${exp.receiptName || 'Anexado'}`, 180);
      doc.text(proof, 14, y);
      y += proof.length * 6 + 2;
      if (exp.receiptPreview && typeof exp.receiptPreview === 'string' && exp.receiptPreview.startsWith('data:image')) {
        try {
          if (y > 210) { doc.addPage(); y = 18; }
          doc.addImage(exp.receiptPreview, 'JPEG', 14, y, 60, 45);
          y += 50;
        } catch (e) {}
      }
    });
  } else {
    doc.text('Nenhum gasto registrado.', 14, y);
    y += 7;
  }

  if (y > 230) { doc.addPage(); y = 18; }
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.text('DECLARAÇÃO', 14, y); y += 7;
  doc.setFont('helvetica', 'normal');
  
  const declaracao = `A empresa ${company.name} de CNPJ ${company.cnpj} declara que o(a) colaborador(a) ${user?.name || '-'} CPF ${user?.cpf || 'Não informado'} realizou a prestação de contas referente à viagem a ${trip.serviceLocation} no período de ${fmtDate(trip.startDate)} a ${fmtDate(trip.endDate)}, estando os valores e comprovantes devidamente analisados e aprovados pelo setor financeiro.`;
  const declaracaoLines = doc.splitTextToSize(declaracao, 180);
  doc.text(declaracaoLines, 14, y);
  y += declaracaoLines.length * 6 + 4;

  const clauses = [
    'O(A) usuário(a) declara que as informações e comprovantes inseridos neste termo correspondem integralmente às despesas da viagem.',
    'O(A) usuário(a) deverá realizar o acerto com o setor financeiro em até 3 dias úteis, devolvendo eventual saldo ou recebendo eventual diferença apurada.',
    'Este termo e seus comprovantes deverão permanecer armazenados por no mínimo 30 dias após a assinatura eletrônica de ambas as partes.',
    'A assinatura eletrônica abaixo confirma a concordância com as normas internas da empresa e com a análise final do setor financeiro.'
  ];
  clauses.forEach(paragraph => {
    const lines = doc.splitTextToSize(paragraph, 180);
    if (y + lines.length * 6 > 265) { doc.addPage(); y = 18; }
    doc.text(lines, 14, y);
    y += lines.length * 6 + 3;
  });

  if (y > 240) { doc.addPage(); y = 18; }
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('ASSINATURA DO(A) COLABORADOR(A)', 14, y); y += 8;
  if (trip.userSignature) {
    try { doc.addImage(trip.userSignature, 'PNG', 14, y, 70, 28); } catch (e) {}
  }
  y += 36;
  doc.setFont('helvetica', 'normal');
  doc.text(`Assinado eletronicamente em: ${fmtDate(trip.userSignatureDate || todayISO())}`, 14, y);
  y += 10;
  
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.text(`São Sebastião do Caí, ${dataExtenso}`, 14, y);

  return doc;
}

function generateCompleteFinalPdf(trip, user) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 18;
  const saldo = settlementAmount(trip);
  const company = getCompanyByTrip(trip);
  const dataExtenso = formatDateExtended();
  const financeiroUser = currentUser();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('DeltaSoft - PRESTAÇÃO FINAL DE VIAGEM', 14, y);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  [
    tripLabel(trip),
    `Colaborador(a): ${user?.name || '-'} • CPF: ${user?.cpf || 'Não informado'}`,
    `Financeiro(a): ${financeiroUser?.name || '-'} • CPF: ${financeiroUser?.cpf || 'Não informado'}`,
    `Empresa: ${company.name} • CNPJ: ${company.cnpj}`,
    `Período: ${fmtDate(trip.startDate)} até ${fmtDate(trip.endDate)}`,
    `Local do serviço: ${trip.serviceLocation}`,
    `Prazo de guarda do termo: 30 dias após a assinatura das duas partes`
  ].forEach(line => { doc.text(line, 14, y); y += 7; });

  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMO FINANCEIRO', 14, y); y += 7;
  doc.setFont('helvetica', 'normal');
  [
    `Valor previsto: ${money(trip.plannedAmount)}`,
    `Forma de liberação: ${trip.paymentTypeLabel || '-'}`,
    `Valor liberado em cartão: ${money(trip.cardAmount || 0)}`,
    `Valor liberado em dinheiro: ${money(trip.cashAmount || 0)}`,
    `Total liberado ao(à) colaborador(a): ${money(Number(trip.cardAmount || 0) + Number(trip.cashAmount || 0))}`,
    `Extras aprovados: ${money((trip.extraFunds || []).filter(x => x.status === 'aprovado').reduce((a, b) => a + Number(b.totalAmount || 0), 0))}`,
    `Total de recursos: ${money(totalApprovedResources(trip))}`,
    `Total de gastos: ${money(tripTotal(trip))}`,
    `${saldo >= 0 ? 'Valor a devolver pelo(a) usuário(a)' : 'Valor a receber de volta pelo(a) usuário(a)'}: ${money(Math.abs(saldo))}`
  ].forEach(line => { doc.text(line, 14, y); y += 7; });

  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.text('DETALHAMENTO DOS GASTOS E COMPROVANTES', 14, y); y += 7;
  doc.setFont('helvetica', 'normal');

  if ((trip.expenses || []).length) {
    trip.expenses.forEach((exp, index) => {
      if (y > 235) { doc.addPage(); y = 18; }
      const lines = doc.splitTextToSize(`${index + 1}. ${exp.description}`, 180);
      doc.text(lines, 14, y); y += lines.length * 6;
      doc.text(`Data: ${fmtDate(exp.date)} | Valor: ${money(exp.amount)} | Pagamento: ${exp.method}`, 14, y); y += 6;
      doc.text(`Comprovante: ${exp.receiptName || 'Anexado'}`, 14, y); y += 6;
      if (exp.receiptPreview && typeof exp.receiptPreview === 'string' && exp.receiptPreview.startsWith('data:image')) {
        try {
          if (y > 200) { doc.addPage(); y = 18; }
          doc.addImage(exp.receiptPreview, 'JPEG', 14, y, 60, 45);
          y += 50;
        } catch (e) {}
      }
      y += 2;
    });
  } else {
    doc.text('Nenhum gasto registrado.', 14, y);
    y += 7;
  }

  if (y > 225) { doc.addPage(); y = 18; }
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.text('DECLARAÇÃO', 14, y); y += 7;
  doc.setFont('helvetica', 'normal');
  
  const declaracao = `A empresa ${company.name} de CNPJ ${company.cnpj} declara que o(a) colaborador(a) ${user?.name || '-'} CPF ${user?.cpf || 'Não informado'} finalizou a prestação de contas da viagem a ${trip.serviceLocation} no período de ${fmtDate(trip.startDate)} a ${fmtDate(trip.endDate)}, estando todas as despesas devidamente comprovadas e aprovadas.`;
  const declaracaoLines = doc.splitTextToSize(declaracao, 180);
  doc.text(declaracaoLines, 14, y);
  y += declaracaoLines.length * 6 + 4;

  const clauses = [
    'O(A) usuário(a) e o(a) financeiro(a) declaram que analisaram os valores, comprovantes e cálculos desta viagem.',
    'O presente termo permanece disponível no sistema e deve ser armazenado por no mínimo 30 dias após a assinatura eletrônica de ambas as partes.',
    'O encerramento desta viagem somente ocorre após a assinatura do(a) usuário(a) e do(a) financeiro(a) neste documento final.'
  ];
  clauses.forEach(paragraph => {
    const lines = doc.splitTextToSize(paragraph, 180);
    if (y + lines.length * 6 > 265) { doc.addPage(); y = 18; }
    doc.text(lines, 14, y);
    y += lines.length * 6 + 3;
  });

  if (y > 220) { doc.addPage(); y = 18; }
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('ASSINATURAS ELETRÔNICAS', 14, y); y += 8;
  doc.setFont('helvetica', 'normal');
  try { if (trip.userSignature) doc.addImage(trip.userSignature, 'PNG', 14, y, 70, 26); } catch (e) {}
  doc.text('Assinatura do(a) colaborador(a)', 14, y + 30);
  try { if (trip.financeSignature) doc.addImage(trip.financeSignature, 'PNG', 110, y, 70, 26); } catch (e) {}
  doc.text('Assinatura do(a) financeiro(a)', 110, y + 30);
  y += 55;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.text(`São Sebastião do Caí, ${dataExtenso}`, 14, y);

  return doc;
}

function buildFullTermSnapshot(trip, user, financeNotes) {
  const saldo = settlementAmount(trip);
  const company = getCompanyByTrip(trip);
  const financeiroUser = currentUser();
  return `<div class="pdf-head"><div><h2>Termo Final de Prestação de Contas</h2><p>${tripLabel(trip)}</p></div><div>${fmtDate(todayISO())}</div></div>
  <div class="pdf-block">
    <p><strong>Colaborador(a):</strong> ${user?.name || '-'} • CPF: ${user?.cpf || 'Não informado'}</p>
    <p><strong>Financeiro(a):</strong> ${financeiroUser?.name || '-'} • CPF: ${financeiroUser?.cpf || 'Não informado'}</p>
    <p><strong>Empresa:</strong> ${company.name} • CNPJ: ${company.cnpj}</p>
    <p><strong>Período:</strong> ${fmtDate(trip.startDate)} até ${fmtDate(trip.endDate)}</p>
    <p><strong>Local do serviço:</strong> ${trip.serviceLocation}</p>
    <p><strong>Prazo para acerto com o financeiro:</strong> ${trip.accountabilityDeadline ? fmtDate(trip.accountabilityDeadline) : '-'} (3 dias úteis)</p>
  </div>
  <div class="pdf-block">
    <p><strong>Valor previsto:</strong> ${money(trip.plannedAmount)}</p>
    <p><strong>Forma de liberação:</strong> ${trip.paymentTypeLabel || '-'}</p>
    <p><strong>Valor liberado em cartão:</strong> ${money(trip.cardAmount || 0)}</p>
    <p><strong>Valor liberado em dinheiro:</strong> ${money(trip.cashAmount || 0)}</p>
    <p><strong>Total liberado ao(à) colaborador(a):</strong> ${money(Number(trip.cardAmount || 0) + Number(trip.cashAmount || 0))}</p>
    <p><strong>Extras aprovados:</strong> ${money((trip.extraFunds || []).filter(x => x.status === 'aprovado').reduce((a, b) => a + Number(b.totalAmount || 0), 0))}</p>
    <p><strong>Total de recursos disponibilizados:</strong> ${money(totalApprovedResources(trip))}</p>
    <p><strong>Total de gastos lançados:</strong> ${money(tripTotal(trip))}</p>
    <p><strong>${saldo >= 0 ? 'Valor a devolver pelo(a) usuário(a)' : 'Valor a receber de volta pelo(a) usuário(a)'}:</strong> ${money(Math.abs(saldo))}</p>
  </div>
  <div class="pdf-block">
    <p><strong>Detalhamento dos gastos e comprovantes:</strong></p>
    ${(trip.expenses || []).length ? (trip.expenses || []).map((exp, index) => `<div class="pdf-proof" style="align-items:flex-start;"><div style="min-width:34px;"><strong>${index + 1}.</strong></div><div style="flex:1;"><strong>${exp.description}</strong><br>Data: ${fmtDate(exp.date)}<br>Valor: ${money(exp.amount)}<br>Forma de pagamento: ${exp.method}<br>Comprovante: ${exp.receiptName || 'Anexado'}${exp.receiptPreview ? `<div style="margin-top:10px;"><img src="${exp.receiptPreview}" alt="${exp.receiptName || 'Comprovante'}" style="width:100%;max-width:360px;border-radius:12px;border:1px solid #d7e4f3;object-fit:contain"></div>` : ''}</div></div>`).join('') : `<div class="small">Nenhum gasto registrado.</div>`}
  </div>
  <div class="legal-notice" style="margin-top:16px;">
    <strong>DECLARAÇÃO</strong>
    <p>A empresa ${company.name} de CNPJ ${company.cnpj} declara que o(a) colaborador(a) ${user?.name || '-'} CPF ${user?.cpf || 'Não informado'} realizou a prestação de contas referente à viagem a ${trip.serviceLocation} no período de ${fmtDate(trip.startDate)} a ${fmtDate(trip.endDate)}, estando os valores e comprovantes devidamente analisados e aprovados pelo setor financeiro.</p>
    <p>O(A) usuário(a) declara que todas as despesas lançadas nesta viagem são legítimas, ocorreram durante o período da viagem e estão devidamente comprovadas com recibos e notas fiscais anexadas.</p>
    <p>O(A) usuário(a) reconhece que deverá realizar o acerto com o setor financeiro em até 3 (três) dias úteis após o encerramento da viagem, devolvendo eventual saldo remanescente ou recebendo eventual diferença apurada.</p>
    <p>Este termo, juntamente com seus comprovantes, deverá permanecer armazenado por no mínimo 30 (trinta) dias após a assinatura eletrônica de ambas as partes.</p>
    <p>A assinatura eletrônica do(a) usuário(a) confirma a veracidade das informações lançadas e autoriza a análise final pelo setor financeiro.</p>
    ${financeNotes ? `<p><strong>Observação do financeiro:</strong> ${financeNotes}</p>` : ''}
  </div>
  <div class="pdf-block" style="margin-top:16px;">
    <p><strong>ASSINATURA DO(A) COLABORADOR(A)</strong></p>
    ${trip.userSignature ? `<p><strong>Assinado eletronicamente em: ${fmtDate(trip.userSignatureDate || todayISO())}</strong></p>` : '<p><em>Aguardando assinatura do(a) colaborador(a)</em></p>'}
  </div>
  <div class="pdf-block" style="margin-top:16px; font-style: italic; font-size: 0.85rem;">
    <p>São Sebastião do Caí, ${formatDateExtended()}</p>
  </div>`;
}

function buildCompleteFinalSnapshot(trip, user) {
  const saldo = settlementAmount(trip);
  const company = getCompanyByTrip(trip);
  const financeiroUser = currentUser();
  return `<div class="pdf-head"><div><h2>Prestação Final de Viagem</h2><p>${tripLabel(trip)}</p></div><div>${fmtDate(todayISO())}</div></div>
  <div class="pdf-block">
    <p><strong>Colaborador(a):</strong> ${user?.name || '-'} • CPF: ${user?.cpf || 'Não informado'}</p>
    <p><strong>Financeiro(a):</strong> ${financeiroUser?.name || '-'} • CPF: ${financeiroUser?.cpf || 'Não informado'}</p>
    <p><strong>Empresa:</strong> ${company.name} • CNPJ: ${company.cnpj}</p>
    <p><strong>Período:</strong> ${fmtDate(trip.startDate)} até ${fmtDate(trip.endDate)}</p>
    <p><strong>Local do serviço:</strong> ${trip.serviceLocation}</p>
  </div>
  <div class="pdf-block">
    <p><strong>Previsto:</strong> ${money(trip.plannedAmount)}</p>
    <p><strong>Forma de liberação:</strong> ${trip.paymentTypeLabel || '-'}</p>
    <p><strong>Valor liberado em cartão:</strong> ${money(trip.cardAmount || 0)}</p>
    <p><strong>Valor liberado em dinheiro:</strong> ${money(trip.cashAmount || 0)}</p>
    <p><strong>Total liberado ao(à) colaborador(a):</strong> ${money(Number(trip.cardAmount || 0) + Number(trip.cashAmount || 0))}</p>
    <p><strong>Recursos totais:</strong> ${money(totalApprovedResources(trip))}</p>
    <p><strong>Gastos lançados:</strong> ${money(tripTotal(trip))}</p>
    <p><strong>${saldo >= 0 ? 'Valor a devolver' : 'Valor a receber de volta'}:</strong> ${money(Math.abs(saldo))}</p>
  </div>
  <div class="pdf-block">
    <p><strong>DECLARAÇÃO</strong></p>
    <p>A empresa ${company.name} de CNPJ ${company.cnpj} declara que o(a) colaborador(a) ${user?.name || '-'} CPF ${user?.cpf || 'Não informado'} finalizou a prestação de contas da viagem a ${trip.serviceLocation} no período de ${fmtDate(trip.startDate)} a ${fmtDate(trip.endDate)}, estando todas as despesas devidamente comprovadas e aprovadas.</p>
    <p><strong>Prazo mínimo de guarda:</strong> 30 dias após a assinatura das duas partes.</p>
  </div>
  <div class="signature-preview" style="margin-top: 16px;">
    <p><strong>Assinatura do(a) colaborador(a):</strong></p>
    <img src="${trip.userSignature}" style="max-width: 200px; border: 1px solid #ccc; border-radius: 8px;">
    <p><strong>Assinatura do(a) financeiro(a):</strong></p>
    <img src="${trip.financeSignature}" style="max-width: 200px; border: 1px solid #ccc; border-radius: 8px;">
  </div>
  <div class="pdf-block" style="margin-top:16px; font-style: italic; font-size: 0.85rem;">
    <p>São Sebastião do Caí, ${formatDateExtended()}</p>
  </div>`;
}

function buildReleaseTermSnapshot(trip, user) {
  const company = getCompanyByTrip(trip);
  const financeiroUser = currentUser();
  return `<div class="pdf-head"><div><h2>Termo de Liberação de Viagem</h2><p>${tripLabel(trip)}</p></div><div>${fmtDate(trip.releaseTermGeneratedAt || todayISO())}</div></div>
  <div class="pdf-block">
    <p><strong>Colaborador(a):</strong> ${user?.name || '-'} • CPF: ${user?.cpf || 'Não informado'}</p>
    <p><strong>Financeiro(a):</strong> ${financeiroUser?.name || '-'} • CPF: ${financeiroUser?.cpf || 'Não informado'}</p>
    <p><strong>Empresa:</strong> ${company.name} • CNPJ: ${company.cnpj}</p>
    <p><strong>Período da viagem:</strong> ${fmtDate(trip.startDate)} até ${fmtDate(trip.endDate)}</p>
    <p><strong>Local do serviço:</strong> ${trip.serviceLocation}</p>
  </div>
  <div class="pdf-block">
    <p><strong>Valor previsto solicitado:</strong> ${money(trip.plannedAmount)}</p>
    <p><strong>Forma de liberação:</strong> ${trip.paymentTypeLabel || '-'}</p>
    <p><strong>Valor liberado em cartão:</strong> ${money(trip.cardAmount || 0)}</p>
    <p><strong>Valor liberado em dinheiro:</strong> ${money(trip.cashAmount || 0)}</p>
    <p><strong>Total liberado ao(à) colaborador(a):</strong> ${money(Number(trip.cardAmount || 0) + Number(trip.cashAmount || 0))}</p>
  </div>
  <div class="legal-notice" style="margin-top:16px;">
    <strong>DECLARAÇÃO DE ENTREGA E RESPONSABILIDADE</strong>
    <p>A empresa ${company.name} de CNPJ ${company.cnpj} declara que os valores acima foram liberados ao(à) colaborador(a) ${user?.name || '-'} CPF ${user?.cpf || 'Não informado'} para custeio exclusivo da viagem corporativa indicada neste documento, seja por cartão corporativo, por dinheiro em espécie, ou por ambos.</p>
    <p>O(A) colaborador(a) declara que recebeu os valores informados, compromete-se a utilizá-los exclusivamente em despesas relacionadas à viagem e reconhece a obrigação de apresentar prestação de contas completa, com comprovantes válidos, dentro do prazo definido pela empresa.</p>
    <p>Este termo deverá ser assinado por ambas as partes. Após as assinaturas, o financeiro deverá digitalizar o documento assinado e anexá-lo ao sistema. Somente após esse anexo a viagem poderá ser liberada.</p>
    <p>Em caso de perda do documento físico, este termo permanecerá disponível para visualização e download no sistema.</p>
  </div>
  <div class="pdf-block">
    <p><strong>Assinaturas obrigatórias no documento físico:</strong></p>
    <div class="sign-grid">
      <div class="sign-box">Assinatura do(a) colaborador(a)</div>
      <div class="sign-box">Assinatura do(a) financeiro(a)</div>
    </div>
  </div>
  ${imagePreviewHtml(trip.releaseTermPhotoFile?.data, trip.releaseTermPhotoFile?.name || 'Documento anexado')}
  <div class="pdf-block" style="margin-top:16px; font-style: italic; font-size: 0.85rem;">
    <p>São Sebastião do Caí, ${formatDateExtended()}</p>
  </div>`;
}

function openReleaseTermPreview(id) {
  const trip = state.trips.find(t => t.id === id);
  if (!trip) return;
  const user = state.users.find(u => u.id === trip.userId);
  const downloadBtn = trip.releaseTermGeneratedFile ? `<a class="btn btn-secondary" href="${trip.releaseTermGeneratedFile.data}" download="${trip.releaseTermGeneratedFile.name}">Baixar PDF</a>` : '';
  const docBtn = trip.releaseTermPhotoFile ? `<a class="btn btn-ghost" href="${trip.releaseTermPhotoFile.data}" download="${trip.releaseTermPhotoFile.name}">Baixar documento anexado</a>` : '';
  modal('Visualização do termo de liberação', `<div class="pdf-preview">${buildReleaseTermSnapshot(trip, user)}</div><div class="actions" style="margin-top:16px;">${downloadBtn}${docBtn}</div>`);
}
window.openReleaseTermPreview = openReleaseTermPreview;

function generateReleaseDeliveryPdf(trip, user) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 18;
  const company = getCompanyByTrip(trip);
  const dataExtenso = formatDateExtended();
  const financeiroUser = currentUser();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('DeltaSoft - TERMO DE LIBERAÇÃO DE VIAGEM', 14, y);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  [
    `${tripLabel(trip)}`,
    `Colaborador(a): ${user?.name || '-'} • CPF: ${user?.cpf || 'Não informado'}`,
    `Financeiro(a): ${financeiroUser?.name || '-'} • CPF: ${financeiroUser?.cpf || 'Não informado'}`,
    `Empresa: ${company.name} • CNPJ: ${company.cnpj}`,
    `Período: ${fmtDate(trip.startDate)} até ${fmtDate(trip.endDate)}`,
    `Local do serviço: ${trip.serviceLocation}`,
    `Forma de liberação: ${trip.paymentTypeLabel || '-'}`,
    `Valor liberado em cartão: ${money(trip.cardAmount || 0)}`,
    `Valor liberado em dinheiro: ${money(trip.cashAmount || 0)}`,
    `Total liberado ao(à) colaborador(a): ${money(Number(trip.cardAmount || 0) + Number(trip.cashAmount || 0))}`
  ].forEach(line => { doc.text(line, 14, y); y += 7; });

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.text('DECLARAÇÃO DE ENTREGA E RESPONSABILIDADE', 14, y); y += 8;
  doc.setFont('helvetica', 'normal');

  const declaracao = `A empresa ${company.name} de CNPJ ${company.cnpj} declara que os valores acima foram liberados ao(à) colaborador(a) ${user?.name || '-'} CPF ${user?.cpf || 'Não informado'} para custeio exclusivo da viagem corporativa identificada neste documento.`;
  const declaracaoLines = doc.splitTextToSize(declaracao, 180);
  doc.text(declaracaoLines, 14, y);
  y += declaracaoLines.length * 6 + 4;

  const paragraphs = [
    'O(A) colaborador(a) declara que recebeu os valores informados e se compromete a utilizá-los exclusivamente em despesas relacionadas à viagem, apresentando a prestação de contas com comprovantes válidos dentro do prazo interno da empresa.',
    'Este termo deverá ser assinado por ambas as partes. Após as assinaturas, o financeiro deverá digitalizar o documento assinado e anexá-lo ao sistema. Somente após esse anexo a viagem poderá ser liberada.',
    'Em caso de perda do documento físico, este termo permanecerá disponível para visualização e download no sistema.'
  ];

  paragraphs.forEach(paragraph => {
    const lines = doc.splitTextToSize(paragraph, 180);
    if (y + lines.length * 6 > 260) { doc.addPage(); y = 18; }
    doc.text(lines, 14, y);
    y += lines.length * 6 + 4;
  });

  y += 10;
  if (y > 245) { doc.addPage(); y = 18; }
  doc.line(20, y, 85, y);
  doc.line(120, y, 185, y);
  y += 7;
  doc.text('Assinatura do(a) colaborador(a)', 23, y);
  doc.text('Assinatura do(a) financeiro(a)', 123, y);
  y += 20;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.text(`São Sebastião do Caí, ${dataExtenso}`, 14, y);

  return doc;
}

function addBusinessDaysISO(dateStr, days) {
  if (!dateStr) return todayISO();
  const d = parseDate(dateStr);
  let remaining = Number(days || 0);
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    const weekDay = d.getDay();
    if (weekDay !== 0 && weekDay !== 6) remaining -= 1;
  }
  return d.toISOString().split('T')[0];
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function resetTestData() {
  if (!confirm('Deseja limpar os dados de teste? Esta ação não pode ser desfeita.')) return;
  state = structuredClone(defaultData);
  saveData();
  currentView = 'dashboard';
  renderApp();
  alert('Dados restaurados para o padrão inicial.');
}
window.resetTestData = resetTestData;

refs.loginForm.addEventListener('submit', ev => {
  ev.preventDefault();
  const email = refs.loginEmail.value.trim().toLowerCase();
  const password = refs.loginPassword.value;
  const user = state.users.find(x => x.email === email && x.password === password);
  if (!user) return alert('E-mail ou senha inválidos.');
  state.currentUserId = user.id;
  saveData();
  currentView = 'dashboard';
  renderApp();
});

refs.logoutBtn.addEventListener('click', () => {
  state.currentUserId = null;
  saveData();
  renderApp();
});

refs.menuToggle.addEventListener('click', () => {
  if (innerWidth <= 980) {
    refs.sidebar.classList.toggle('open');
  } else {
    refs.sidebar.classList.toggle('collapsed');
    refs.sidebar.classList.toggle('expanded');
  }
});

refs.profilePhotoInput.addEventListener('change', async ev => {
  const file = ev.target.files[0];
  const user = currentUser();
  if (!file || !user) return;
  user.photo = await fileToData(file);
  saveData();
  refs.profileAvatar.src = user.photo;
});

document.addEventListener('click', e => {
  if (innerWidth <= 980) {
    const inside = refs.sidebar.contains(e.target);
    const toggle = refs.menuToggle.contains(e.target);
    if (!inside && !toggle) refs.sidebar.classList.remove('open');
  }
});

document.querySelectorAll('.test-user').forEach(btn => {
  btn.addEventListener('click', () => {
    refs.loginEmail.value = btn.dataset.email;
    refs.loginPassword.value = btn.dataset.password;
  });
});

renderApp();
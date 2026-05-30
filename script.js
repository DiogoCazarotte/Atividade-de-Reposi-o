
class Sensor {
  constructor(nome, tipo, valor) {
    this.id       = Date.now().toString(36) + Math.random().toString(36).slice(2);
    this.nome     = nome.trim().toUpperCase();
    this.tipo     = tipo.trim().toUpperCase();
    this.valor    = parseFloat(valor);
    this.criadoEm = new Date().toLocaleString('pt-BR');
  }

  // Método de status — regras de criticidade industriais
  getStatus() {
    const v = this.valor;
    if (this.tipo === 'TEMPERATURA' && v > 50)             return 'CRÍTICO';
    if (this.tipo === 'PRESSAO'     && v > 100)            return 'CRÍTICO';
    if (this.tipo === 'UMIDADE'     && (v < 30 || v > 80)) return 'CRÍTICO';
    return 'NORMAL';
  }

  getUnidade() {
    const u = { TEMPERATURA: '°C', PRESSAO: 'Bar', UMIDADE: '%' };
    return u[this.tipo] || '';
  }

  getBadgeClass() {
    const b = { TEMPERATURA: 'badge-temp', PRESSAO: 'badge-press', UMIDADE: 'badge-umid' };
    return b[this.tipo] || '';
  }

  getTipoLabel() {
    const l = { TEMPERATURA: 'TEMP', PRESSAO: 'PRESS', UMIDADE: 'UMID' };
    return l[this.tipo] || this.tipo;
  }

  getIcone() {
    const i = { TEMPERATURA: '🌡', PRESSAO: '⚙', UMIDADE: '💧' };
    return i[this.tipo] || '📡';
  }
}


let sensores      = [];
let grafico       = null;
let filtroAtual   = 'TODOS';
const STORAGE_KEY = 'iot_sentinel_v1';


function salvarStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sensores));
}

function carregarStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  const arr = JSON.parse(raw);

  // Restaurar instâncias reais da classe Sensor
  sensores = arr.map(s => {
    const inst      = new Sensor(s.nome, s.tipo, s.valor);
    inst.id         = s.id;
    inst.criadoEm   = s.criadoEm;
    return inst;
  });
}

function adicionarSensor() {
  const inputNome  = document.getElementById('inputNome');
  const inputTipo  = document.getElementById('inputTipo');
  const inputValor = document.getElementById('inputValor');

  // Higienização obrigatória: .trim() e .toUpperCase()
  const nome  = inputNome.value.trim();
  const tipo  = inputTipo.value.trim().toUpperCase();
  const valor = inputValor.value.trim();

  // Validações
  if (!nome) {
    inputNome.classList.add('error');
    document.getElementById('hintNome').textContent = 'Nome obrigatório.';
    toast('Informe o nome do sensor.', 'err');
    inputNome.focus();
    return;
  }
  if (!tipo) {
    toast('Selecione o tipo do sensor.', 'err');
    return;
  }
  if (valor === '' || isNaN(parseFloat(valor))) {
    inputValor.classList.add('error');
    document.getElementById('hintValor').textContent = 'Valor numérico obrigatório.';
    toast('Informe um valor numérico.', 'err');
    inputValor.focus();
    return;
  }

  // Instanciar classe Sensor
  const novo = new Sensor(nome, tipo, valor);

  // Inserir no array global
  sensores.push(novo);

  // Persistir no localStorage
  salvarStorage();

  // Limpar formulário
  limparFormulario();

  // Atualizar interface
  renderizarCards();
  atualizarGrafico();
  atualizarKPIs();
  atualizarFooter();

  // Feedback
  const st   = novo.getStatus();
  const tipo_ = st === 'CRÍTICO' ? 'warn' : 'ok';
  toast(`${novo.getIcone()} Sensor adicionado — ${st}`, tipo_);
}


function renderizarCards() {
  const grid = document.getElementById('sensoresGrid');

  // Passo 1: limpar completamente o container
  grid.innerHTML = '';

  // Passo 2: filter() para segregar por categoria
  let lista = sensores;
  if (filtroAtual !== 'TODOS') {
    lista = sensores.filter(s => s.tipo === filtroAtual);
  }

  // Estado vazio
  if (lista.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📡</div>
        <p>${filtroAtual === 'TODOS' ? 'Nenhum sensor cadastrado.' : 'Nenhum sensor nesta categoria.'}</p>
        <p class="empty-sub">Use o painel lateral para adicionar sensores.</p>
      </div>`;
    return;
  }

  // Passo 3: forEach() para renderizar cada card dinamicamente
  lista.forEach(sensor => {
    const status  = sensor.getStatus();
    const isCrit  = status === 'CRÍTICO';
    const card    = document.createElement('div');

    // Aplicar classe crítico quando necessário — borda vermelha + animação CSS keyframes
    card.className = isCrit ? 'sensor-card critical' : 'sensor-card';
    card.setAttribute('data-tipo', sensor.tipo);

    card.innerHTML = `
      ${isCrit ? '<div class="card-crit-icon">⚠</div>' : ''}
      <div class="card-top">
        <div class="card-name">${toTitleCase(sensor.nome)}</div>
        <span class="badge ${sensor.getBadgeClass()}">${sensor.getTipoLabel()}</span>
      </div>
      <div class="card-value-row">
        <span class="card-value">${sensor.valor}</span>
        <span class="card-unit">${sensor.getUnidade()}</span>
      </div>
      <div class="card-bottom">
        <span class="status-tag ${isCrit ? 'st-critical' : 'st-normal'}">
          ${isCrit ? '⚠ ' : '● '}${status}
        </span>
        <button class="btn-del" title="Remover" onclick="removerSensor('${sensor.id}')">✕</button>
      </div>
    `;

    grid.appendChild(card);
  });
}


function calcularMedia(tipo) {
  // filter() — segregar por categoria
  const filtrados = sensores.filter(s => s.tipo === tipo);
  if (filtrados.length === 0) return 0;

  // reduce() — somar e calcular média
  const soma = filtrados.reduce((acumulador, s) => acumulador + s.valor, 0);
  return soma / filtrados.length;
}

function calcularMin(tipo) {
  const f = sensores.filter(s => s.tipo === tipo);
  if (!f.length) return null;
  return f.reduce((min, s) => s.valor < min ? s.valor : min, f[0].valor);
}

function calcularMax(tipo) {
  const f = sensores.filter(s => s.tipo === tipo);
  if (!f.length) return null;
  return f.reduce((max, s) => s.valor > max ? s.valor : max, f[0].valor);
}


function atualizarGrafico() {
  const tipos  = ['TEMPERATURA', 'PRESSAO', 'UMIDADE'];
  const labels = ['Temperatura (°C)', 'Pressão (Bar)', 'Umidade (%)'];

  // Médias calculadas via filter + reduce
  const medias = tipos.map(t => parseFloat(calcularMedia(t).toFixed(2)));
  const qtds   = tipos.map(t => sensores.filter(s => s.tipo === t).length);

  if (grafico) {
    // Atualizar datasets existentes em tempo de execução
    grafico.data.datasets[0].data = medias;
    grafico.data.datasets[1].data = qtds;
    grafico.update();
    return;
  }

  const ctx = document.getElementById('graficoBarras').getContext('2d');

  grafico = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Média do Valor',
          data: medias,
          backgroundColor: ['#7a3a18', '#183a6a', '#2a1850'],
          borderColor:     ['#c8784a', '#4a8fff', '#8a65d4'],
          borderWidth: 2,
          borderRadius: 4,
        },
        {
          label: 'Quantidade',
          data: qtds,
          backgroundColor: '#2a2a2a',
          borderColor: '#444',
          borderWidth: 1,
          borderRadius: 4,
          yAxisID: 'y2',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#888',
            font: { family: 'JetBrains Mono, monospace', size: 11 },
            boxWidth: 12,
          }
        },
        tooltip: {
          backgroundColor: '#1c1c1c',
          borderColor: '#3a3a3a',
          borderWidth: 1,
          titleColor: '#d8d8d8',
          bodyColor: '#888',
          titleFont: { family: 'Inter', size: 12 },
          bodyFont:  { family: 'JetBrains Mono, monospace', size: 11 },
        }
      },
      scales: {
        x: {
          grid: { color: '#2a2a2a' },
          ticks: { color: '#666', font: { family: 'Inter', size: 11 } }
        },
        y: {
          grid: { color: '#2a2a2a' },
          ticks: { color: '#666', font: { family: 'JetBrains Mono, monospace', size: 10 } },
          beginAtZero: true,
        },
        y2: {
          position: 'right',
          grid: { display: false },
          ticks: { color: '#555', font: { family: 'JetBrains Mono, monospace', size: 10 }, stepSize: 1 },
          beginAtZero: true,
        }
      }
    }
  });
}

function atualizarKPIs() {
  const mTemp  = calcularMedia('TEMPERATURA');
  const mPress = calcularMedia('PRESSAO');
  const mUmid  = calcularMedia('UMIDADE');
  const nCrit  = sensores.filter(s => s.getStatus() === 'CRÍTICO').length;

  const hasTemp  = sensores.filter(s => s.tipo === 'TEMPERATURA').length > 0;
  const hasPress = sensores.filter(s => s.tipo === 'PRESSAO').length > 0;
  const hasUmid  = sensores.filter(s => s.tipo === 'UMIDADE').length > 0;

  document.getElementById('kpiTemp').textContent   = hasTemp  ? `${mTemp.toFixed(1)} °C`  : '—';
  document.getElementById('kpiPress').textContent  = hasPress ? `${mPress.toFixed(1)} Bar` : '—';
  document.getElementById('kpiUmid').textContent   = hasUmid  ? `${mUmid.toFixed(1)} %`   : '—';
  document.getElementById('kpiCrit').textContent   = nCrit;

  const alertCard = document.getElementById('kpiAlertCard');
  alertCard.classList.toggle('has-critical', nCrit > 0);

  // Dot do topbar
  const dot = document.getElementById('statusDot');
  dot.className = nCrit > 0 ? 'topbar-dot alert' : 'topbar-dot';
}

function atualizarFooter() {
  document.getElementById('footerTotal').textContent = sensores.length;
  const c = sensores.filter(s => s.getStatus() === 'CRÍTICO').length;
  document.getElementById('footerCrit').textContent  = c;
}

function filtrarCards(tipo) {
  filtroAtual = tipo;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim() === tipo || btn.textContent.trim() === 'Todos' && tipo === 'TODOS');
  });
  renderizarCards();
}


function removerSensor(id) {
  sensores = sensores.filter(s => s.id !== id);
  salvarStorage();
  renderizarCards();
  atualizarGrafico();
  atualizarKPIs();
  atualizarFooter();
  toast('Sensor removido.', 'err');
}

function limparTodos() {
  if (!sensores.length) { toast('Nenhum sensor para remover.', 'err'); return; }
  if (!confirm('Remover TODOS os sensores?')) return;
  sensores = [];
  salvarStorage();
  renderizarCards();
  atualizarGrafico();
  atualizarKPIs();
  atualizarFooter();
  toast('Todos os sensores foram removidos.', 'err');
}



// onkeyup — validação em tempo real
function validarCampo(el) {
  el.classList.remove('error');
  const hintId = 'hint' + el.id.replace('input', '');
  const h = document.getElementById(hintId);
  if (h) h.textContent = '';
}

// onblur — validação ao perder o foco
function validarBlur(el) {
  const val = el.value.trim();
  if (!val) {
    el.classList.add('error');
    const hintId = 'hint' + el.id.replace('input', '');
    const h = document.getElementById(hintId);
    if (h) h.textContent = el.id === 'inputNome' ? 'Campo obrigatório.' : 'Informe um valor.';
  }
}

// onkeydown — Enter submete o formulário
function teclaEnter(e) {
  if (e.key === 'Enter') { e.preventDefault(); adicionarSensor(); }
}


function atualizarUnidade() {
  const tipo = document.getElementById('inputTipo').value;
  const u    = { TEMPERATURA: '°C', PRESSAO: 'Bar', UMIDADE: '%' };
  document.getElementById('unidadeLabel').textContent = u[tipo] || '';
}


function limparFormulario() {
  document.getElementById('inputNome').value  = '';
  document.getElementById('inputTipo').value  = '';
  document.getElementById('inputValor').value = '';
  document.getElementById('hintNome').textContent  = '';
  document.getElementById('hintValor').textContent = '';
  document.getElementById('unidadeLabel').textContent = '';
  document.querySelectorAll('.sidebar input').forEach(i => i.classList.remove('error'));
}

function addTeste(nome, tipo, valor) {
  document.getElementById('inputNome').value  = nome;
  document.getElementById('inputTipo').value  = tipo;
  document.getElementById('inputValor').value = valor;
  atualizarUnidade();
  adicionarSensor();
}


function toast(msg, tipo = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast t-${tipo} show`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3000);
}


function iniciarRelogio() {
  const el = document.getElementById('timeDisplay');
  const tick = () => { el.textContent = new Date().toLocaleTimeString('pt-BR'); };
  tick();
  setInterval(tick, 1000);
}


function toTitleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

(function init() {
  carregarStorage();
  renderizarCards();
  atualizarKPIs();
  atualizarFooter();
  iniciarRelogio();
  setTimeout(atualizarGrafico, 80);
})();

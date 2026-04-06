/* ═══════════════════════════════════════
   MONITOR DE AÇÕES B3
   Cotações em tempo quase real via Brapi.dev
   ═══════════════════════════════════════ */

/* ─── CONFIGURAÇÃO ────────────────────── */

/** Tickers monitorados agrupados por setor */
const TICKERS = {
    bancos:    ['ITUB4', 'BBDC4', 'BBAS3', 'ITSA4', 'B3SA3'],
    petroleo:  ['PETR4', 'PETR3', 'PRIO3', 'CSAN3'],
    mineracao: ['VALE3', 'SUZB3', 'GGBR4'],
    varejo:    ['MGLU3', 'LREN3', 'ABEV3', 'RADL3'],
    industria: ['WEGE3', 'RENT3', 'JBSS3', 'HAPV3'],
};

/** Índices especiais (KPI cards) */
const INDICES = ['^BVSP', 'USDBRL'];

/** Lista flat de todos os tickers */
const ALL_TICKERS = Object.values(TICKERS).flat();

/** Mapa reverso: ticker → setor */
const SETOR_MAP = {};
for (const [setor, tickers] of Object.entries(TICKERS)) {
    tickers.forEach(t => SETOR_MAP[t] = setor);
}

/** Nomes legíveis dos setores */
const SETOR_LABELS = {
    bancos: 'Bancos', petroleo: 'Petroleo/Energia',
    mineracao: 'Mineracao/Siderurgia', varejo: 'Varejo/Consumo',
    industria: 'Industria',
};

/** Delay entre requests para respeitar rate limit (ms) */
const FETCH_DELAY = 300;

/** Intervalo de polling em ms (60 segundos) */
const POLL_INTERVAL = 60000;

/* ─── ESTADO GLOBAL ───────────────────── */

const APP = {
    quotes: {},       // { PETR4: { symbol, price, change, ... }, ... }
    indices: {},      // { ^BVSP: ..., USDBRL: ... }
    filter: 'todos',  // setor ativo
    sort: 'variacao', // critério de ordenação
    search: '',       // busca por ticker
    polling: null,    // referência do setInterval
    loading: true,    // carregando dados iniciais
};

/* ─── API ─────────────────────────────── */

/**
 * Busca cotação de um ticker na API Brapi.
 * @param {string} ticker - Ex: "PETR4", "^BVSP"
 * @returns {Object|null} Dados da cotação ou null se falhar
 */
async function fetchQuote(ticker) {
    try {
        const resp = await fetch(`https://brapi.dev/api/quote/${encodeURIComponent(ticker)}`);
        if (!resp.ok) return null;
        const data = await resp.json();
        const r = data.results?.[0];
        if (!r) return null;
        return {
            symbol: r.symbol,
            shortName: r.shortName || r.symbol,
            longName: r.longName || r.shortName || r.symbol,
            price: r.regularMarketPrice ?? 0,
            change: r.regularMarketChange ?? 0,
            changePercent: r.regularMarketChangePercent ?? 0,
            high: r.regularMarketDayHigh ?? 0,
            low: r.regularMarketDayLow ?? 0,
            open: r.regularMarketOpen ?? 0,
            prevClose: r.regularMarketPreviousClose ?? 0,
            volume: r.regularMarketVolume ?? 0,
            marketCap: r.marketCap ?? 0,
            pe: r.priceEarnings ?? null,
            eps: r.earningsPerShare ?? null,
            week52High: r.fiftyTwoWeekHigh ?? 0,
            week52Low: r.fiftyTwoWeekLow ?? 0,
            logo: r.logourl || null,
            time: r.regularMarketTime || null,
        };
    } catch (e) {
        console.warn(`Erro ao buscar ${ticker}:`, e.message);
        return null;
    }
}

/**
 * Busca todas as cotações sequencialmente com delay entre cada.
 * @param {string[]} tickers - Lista de tickers
 * @returns {Object} Mapa { ticker: dados }
 */
async function fetchAll(tickers) {
    const results = {};
    for (const ticker of tickers) {
        const data = await fetchQuote(ticker);
        if (data) results[ticker] = data;
        await sleep(FETCH_DELAY);
    }
    return results;
}

/** Espera N milissegundos */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ─── UTILIDADES ──────────────────────── */

/** Formata valor em BRL */
function fmtBRL(v) {
    return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Formata número grande (volume, market cap) */
function fmtNum(v) {
    if (v >= 1e12) return (v / 1e12).toFixed(1) + ' tri';
    if (v >= 1e9) return (v / 1e9).toFixed(1) + ' bi';
    if (v >= 1e6) return (v / 1e6).toFixed(1) + ' mi';
    if (v >= 1e3) return (v / 1e3).toFixed(0) + ' mil';
    return v.toLocaleString('pt-BR');
}

/** Verifica se o mercado B3 está aberto (10h-17h BRT, dias úteis) */
function mercadoAberto() {
    const now = new Date();
    const brt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const hora = brt.getHours();
    const dia = brt.getDay();
    return dia >= 1 && dia <= 5 && hora >= 10 && hora < 17;
}

/** Retorna horário atual formatado */
function horaAtual() {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/* ─── RENDERIZAÇÃO ────────────────────── */

/** Atualiza KPI cards (IBOV, Dólar, stats) */
function renderKPIs() {
    const ibov = APP.indices['^BVSP'];
    const dolar = APP.indices['USDBRL'];
    const quotes = Object.values(APP.quotes);
    const positivas = quotes.filter(q => q.changePercent > 0).length;
    const volumeTotal = quotes.reduce((s, q) => s + q.volume, 0);

    document.getElementById('kpiGrid').innerHTML = `
        <div class="kpi-card">
            <div class="kpi-label">IBOVESPA</div>
            <div class="kpi-value">${ibov ? fmtNum(ibov.price) : '--'}
                ${ibov ? `<span class="kpi-delta ${ibov.changePercent >= 0 ? 'up' : 'down'}">${ibov.changePercent >= 0 ? '▲' : '▼'} ${Math.abs(ibov.changePercent).toFixed(2)}%</span>` : ''}
            </div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">DOLAR (PTAX)</div>
            <div class="kpi-value">${dolar ? fmtBRL(dolar.price) : '--'}
                ${dolar ? `<span class="kpi-delta ${dolar.changePercent >= 0 ? 'up' : 'down'}">${dolar.changePercent >= 0 ? '▲' : '▼'} ${Math.abs(dolar.changePercent).toFixed(2)}%</span>` : ''}
            </div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">ACOES EM ALTA</div>
            <div class="kpi-value">${positivas}<span class="kpi-delta" style="color:var(--text-muted)">/ ${quotes.length}</span></div>
            <div class="kpi-sub">${quotes.length - positivas} em queda</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">VOLUME TOTAL</div>
            <div class="kpi-value">${fmtNum(volumeTotal)}</div>
            <div class="kpi-sub">${quotes.length} acoes monitoradas</div>
        </div>
    `;
}

/** Renderiza o grid de cards de ações */
function renderGrid() {
    const grid = document.getElementById('stockGrid');
    let quotes = Object.values(APP.quotes);

    // Filtrar por setor
    if (APP.filter !== 'todos') {
        quotes = quotes.filter(q => SETOR_MAP[q.symbol] === APP.filter);
    }

    // Filtrar por busca
    if (APP.search) {
        const s = APP.search.toUpperCase();
        quotes = quotes.filter(q => q.symbol.includes(s) || q.longName.toUpperCase().includes(s));
    }

    // Ordenar
    switch (APP.sort) {
        case 'variacao': quotes.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)); break;
        case 'preco': quotes.sort((a, b) => b.price - a.price); break;
        case 'volume': quotes.sort((a, b) => b.volume - a.volume); break;
        case 'nome': quotes.sort((a, b) => a.symbol.localeCompare(b.symbol)); break;
    }

    if (!quotes.length) {
        grid.innerHTML = '<div class="no-results">Nenhuma acao encontrada</div>';
        return;
    }

    grid.innerHTML = quotes.map(q => {
        const up = q.changePercent >= 0;
        const varClass = up ? 'up' : 'down';
        const arrow = up ? '▲' : '▼';
        // Posição na range 52 semanas (0 a 100%)
        const range52 = q.week52High > q.week52Low
            ? ((q.price - q.week52Low) / (q.week52High - q.week52Low) * 100).toFixed(0)
            : 50;

        return `
        <div class="stock-card" data-ticker="${q.symbol}" onclick="openDetail('${q.symbol}')">
            ${q.logo
                ? `<img class="stock-logo" src="${q.logo}" alt="${q.symbol}" onerror="this.outerHTML='<div class=\\'stock-logo-fallback\\'>${q.symbol.slice(0,2)}</div>'">`
                : `<div class="stock-logo-fallback">${q.symbol.slice(0, 2)}</div>`
            }
            <div class="stock-info">
                <div class="stock-ticker">${q.symbol}</div>
                <div class="stock-name">${q.longName}</div>
            </div>
            <div class="stock-price-area">
                <div class="stock-price">${fmtBRL(q.price)}</div>
                <div class="stock-var ${varClass}">${arrow} ${Math.abs(q.changePercent).toFixed(2)}%</div>
            </div>
            <div class="stock-meta">
                <div class="stock-meta-item"><span>Volume</span><span class="stock-meta-val">${fmtNum(q.volume)}</span></div>
                <div class="stock-meta-item"><span>Min/Max</span><span class="stock-meta-val">${q.low.toFixed(2)} / ${q.high.toFixed(2)}</span></div>
                <div class="range-bar"><div class="range-fill" style="width:100%"></div><div class="range-dot" style="left:${range52}%"></div></div>
            </div>
        </div>`;
    }).join('');
}

/** Abre modal de detalhes de uma ação */
function openDetail(ticker) {
    const q = APP.quotes[ticker];
    if (!q) return;

    const overlay = document.getElementById('detailOverlay');
    const card = document.getElementById('detailCard');
    const up = q.changePercent >= 0;
    const varClass = up ? 'up' : 'down';

    card.innerHTML = `
        <div class="detail-header">
            <div>
                <div class="detail-ticker">${q.symbol}</div>
                <div class="detail-name">${q.longName}</div>
            </div>
            <button class="detail-close" onclick="closeDetail()">&times;</button>
        </div>
        <div class="detail-price">${fmtBRL(q.price)}</div>
        <div class="detail-var ${varClass}">${up ? '▲' : '▼'} ${fmtBRL(Math.abs(q.change))} (${Math.abs(q.changePercent).toFixed(2)}%)</div>
        <div class="detail-chart" id="detailChartContainer"></div>
        <div class="detail-grid">
            <div class="detail-item"><div class="detail-item-label">Abertura</div><div class="detail-item-value">${fmtBRL(q.open)}</div></div>
            <div class="detail-item"><div class="detail-item-label">Fech. Anterior</div><div class="detail-item-value">${fmtBRL(q.prevClose)}</div></div>
            <div class="detail-item"><div class="detail-item-label">Minima do dia</div><div class="detail-item-value">${fmtBRL(q.low)}</div></div>
            <div class="detail-item"><div class="detail-item-label">Maxima do dia</div><div class="detail-item-value">${fmtBRL(q.high)}</div></div>
            <div class="detail-item"><div class="detail-item-label">Volume</div><div class="detail-item-value">${fmtNum(q.volume)}</div></div>
            <div class="detail-item"><div class="detail-item-label">Market Cap</div><div class="detail-item-value">${q.marketCap ? fmtNum(q.marketCap) : '--'}</div></div>
            <div class="detail-item"><div class="detail-item-label">P/L</div><div class="detail-item-value">${q.pe ? q.pe.toFixed(1) : '--'}</div></div>
            <div class="detail-item"><div class="detail-item-label">LPA</div><div class="detail-item-value">${q.eps ? fmtBRL(q.eps) : '--'}</div></div>
            <div class="detail-item"><div class="detail-item-label">Min 52 sem</div><div class="detail-item-value">${fmtBRL(q.week52Low)}</div></div>
            <div class="detail-item"><div class="detail-item-label">Max 52 sem</div><div class="detail-item-value">${fmtBRL(q.week52High)}</div></div>
        </div>
    `;

    overlay.classList.add('open');

    // Renderizar mini gráfico com TradingView Lightweight Charts
    renderDetailChart(q);
}

/** Fecha o modal de detalhes */
function closeDetail() {
    document.getElementById('detailOverlay').classList.remove('open');
}

/** Renderiza gráfico no modal de detalhes */
function renderDetailChart(q) {
    const container = document.getElementById('detailChartContainer');
    if (!container || typeof LightweightCharts === 'undefined') return;

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    const chart = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: 250,
        layout: {
            background: { color: isDark ? '#161b22' : '#ffffff' },
            textColor: isDark ? '#8b949e' : '#656d76',
            fontFamily: "'Inter', sans-serif",
        },
        grid: {
            vertLines: { color: isDark ? '#21262d' : '#f0f0f0' },
            horzLines: { color: isDark ? '#21262d' : '#f0f0f0' },
        },
        rightPriceScale: { borderColor: isDark ? '#30363d' : '#d0d7de' },
        timeScale: { borderColor: isDark ? '#30363d' : '#d0d7de' },
    });

    const series = chart.addAreaSeries({
        lineColor: '#5eead4',
        topColor: 'rgba(94,234,212,.2)',
        bottomColor: 'rgba(94,234,212,.02)',
        lineWidth: 2,
    });

    // Gerar dados simulados intraday (preço oscilando entre low e high)
    const points = [];
    const baseTime = Math.floor(Date.now() / 1000) - 8 * 3600; // 8h atrás
    const range = q.high - q.low || 1;
    let price = q.open || q.prevClose || q.price;
    for (let i = 0; i < 48; i++) { // 48 pontos (10min cada)
        price += (Math.random() - 0.48) * range * 0.1;
        price = Math.max(q.low, Math.min(q.high, price));
        points.push({ time: baseTime + i * 600, value: parseFloat(price.toFixed(2)) });
    }
    // Último ponto = preço atual
    points.push({ time: baseTime + 48 * 600, value: q.price });

    series.setData(points);
    chart.timeScale().fitContent();
}

/* ─── STATUS & POLLING ────────────────── */

/** Atualiza badge e timestamp */
function updateStatus() {
    const badge = document.getElementById('statusBadge');
    const ts = document.getElementById('lastUpdate');

    if (mercadoAberto()) {
        badge.textContent = 'LIVE';
        badge.className = 'header-badge live';
    } else {
        badge.textContent = 'FECHADO';
        badge.className = 'header-badge closed';
    }
    ts.textContent = horaAtual();
}

/** Ciclo de polling: busca cotações e atualiza UI */
async function pollCycle() {
    updateStatus();

    // Buscar índices
    const idxData = await fetchAll(INDICES);
    Object.assign(APP.indices, idxData);

    // Buscar ações
    const stockData = await fetchAll(ALL_TICKERS);
    Object.assign(APP.quotes, stockData);

    // Atualizar UI
    renderKPIs();
    renderGrid();
    updateStatus();
    APP.loading = false;
}

/** Inicia polling automático */
function startPolling() {
    if (APP.polling) clearInterval(APP.polling);
    APP.polling = setInterval(() => {
        if (mercadoAberto()) pollCycle();
        else updateStatus();
    }, POLL_INTERVAL);
}

/* ─── EVENTOS ─────────────────────────── */

function init() {
    // Theme toggle
    const saved = localStorage.getItem('theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);

    document.getElementById('themeToggle').addEventListener('click', () => {
        const h = document.documentElement;
        const isDark = h.getAttribute('data-theme') !== 'light';
        h.setAttribute('data-theme', isDark ? 'light' : 'dark');
        localStorage.setItem('theme', isDark ? 'light' : 'dark');
        document.getElementById('themeToggle').textContent = isDark ? '\u263E' : '\u2606';
    });

    // Filtro por setor (pills)
    document.querySelectorAll('.pill').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            APP.filter = btn.dataset.sector;
            renderGrid();
        });
    });

    // Busca
    document.getElementById('searchInput').addEventListener('input', (e) => {
        APP.search = e.target.value.trim();
        renderGrid();
    });

    // Ordenação
    document.getElementById('sortSelect').addEventListener('change', (e) => {
        APP.sort = e.target.value;
        renderGrid();
    });

    // Fechar modal com ESC ou clique fora
    document.getElementById('detailOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'detailOverlay') closeDetail();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDetail();
    });

    // Carregar dados e iniciar polling
    updateStatus();
    pollCycle().then(() => startPolling());
}

init();

/* ═══════════════════════════════════════
   MONITOR DE AÇÕES B3
   Cotações via Yahoo Finance + allorigins proxy
   ═══════════════════════════════════════ */

/* ─── CONFIGURAÇÃO ────────────────────── */

/** Proxy CORS para acessar Yahoo Finance do browser */
const PROXY = 'https://api.allorigins.win/raw?url=';
const YAHOO = 'https://query1.finance.yahoo.com/v8/finance/chart/';

/** Tickers agrupados por setor */
const SETORES = {
    bancos:     { label: 'Bancos',              tickers: ['ITUB4','BBDC4','BBAS3','ITSA4','B3SA3','SANB11'] },
    petroleo:   { label: 'Petroleo/Energia',    tickers: ['PETR4','PETR3','PRIO3','CSAN3','UGPA3'] },
    mineracao:  { label: 'Mineracao/Siderurgia', tickers: ['VALE3','SUZB3','GGBR4','CSNA3','KLBN11'] },
    varejo:     { label: 'Varejo/Consumo',      tickers: ['MGLU3','LREN3','ABEV3','RADL3','NTCO3'] },
    industria:  { label: 'Industria',           tickers: ['WEGE3','RENT3','JBSS3','HAPV3','EMBR3'] },
    energia:    { label: 'Energia/Util.',       tickers: ['ELET3','EQTL3','CPFE3','TAEE11','CMIG4'] },
    outros:     { label: 'Outros',              tickers: ['VIVT3','TOTS3','BBSE3','CCRO3','RAIL3'] },
};

/** Lista flat de todos os tickers */
const ALL_TICKERS = Object.values(SETORES).flatMap(s => s.tickers);

/** Mapa reverso: ticker → setor key */
const SETOR_MAP = {};
for (const [key, { tickers }] of Object.entries(SETORES)) {
    tickers.forEach(t => SETOR_MAP[t] = key);
}

/** Intervalo de polling (ms) */
const POLL_INTERVAL = 60000;

/** Delay entre requests batch (ms) */
const BATCH_DELAY = 150;

/* ─── ESTADO ──────────────────────────── */

const APP = {
    quotes: {},        // { PETR4: { symbol, price, change, ... } }
    history: {},       // { PETR4: [{ date, close }, ...] } — últimos 30 dias
    filter: 'todos',
    sort: 'variacao',
    search: '',
    polling: null,
    loading: true,
    customTickers: [],  // tickers adicionados pelo usuário
};

/* ─── API (Yahoo Finance + proxy) ─────── */

/**
 * Busca cotação e histórico de 1 mês de um ticker via Yahoo Finance.
 * @param {string} ticker - Ticker B3 (sem .SA)
 * @returns {{ quote: Object, history: Array } | null}
 */
async function fetchTicker(ticker) {
    try {
        const yahooTicker = ticker + '.SA';
        const url = `${YAHOO}${yahooTicker}?interval=1d&range=1mo&includePrePost=false`;
        const resp = await fetch(PROXY + encodeURIComponent(url));
        if (!resp.ok) return null;
        const data = await resp.json();
        const result = data.chart?.result?.[0];
        if (!result) return null;

        const meta = result.meta;
        const timestamps = result.timestamp || [];
        const closes = result.indicators?.quote?.[0]?.close || [];
        const volumes = result.indicators?.quote?.[0]?.volume || [];
        const highs = result.indicators?.quote?.[0]?.high || [];
        const lows = result.indicators?.quote?.[0]?.low || [];

        // Cotação atual
        const quote = {
            symbol: ticker,
            longName: meta.longName || meta.shortName || ticker,
            price: meta.regularMarketPrice ?? 0,
            prevClose: meta.previousClose ?? meta.chartPreviousClose ?? 0,
            change: (meta.regularMarketPrice ?? 0) - (meta.previousClose ?? meta.chartPreviousClose ?? 0),
            changePercent: meta.previousClose ? ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose * 100) : 0,
            high: Math.max(...highs.filter(v => v != null).slice(-1), meta.regularMarketPrice),
            low: Math.min(...lows.filter(v => v != null).slice(-1), meta.regularMarketPrice),
            volume: volumes.length ? volumes[volumes.length - 1] || 0 : 0,
            marketCap: meta.marketCap ?? null,
            week52High: meta.fiftyTwoWeekHigh ?? 0,
            week52Low: meta.fiftyTwoWeekLow ?? 0,
            currency: meta.currency || 'BRL',
        };

        // Histórico para gráfico
        const history = timestamps.map((t, i) => ({
            date: new Date(t * 1000).toISOString().slice(0, 10),
            close: closes[i],
            volume: volumes[i],
        })).filter(p => p.close != null);

        return { quote, history };
    } catch (e) {
        console.warn(`Erro ${ticker}:`, e.message);
        return null;
    }
}

/**
 * Busca todos os tickers em batch com delay entre cada.
 * @param {string[]} tickers
 */
async function fetchAll(tickers) {
    const total = tickers.length;
    let loaded = 0;

    for (const ticker of tickers) {
        const data = await fetchTicker(ticker);
        if (data) {
            APP.quotes[ticker] = data.quote;
            APP.history[ticker] = data.history;
        }
        loaded++;
        // Atualizar progresso
        if (APP.loading) updateLoadingProgress(loaded, total);
        await sleep(BATCH_DELAY);
    }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ─── UTILITÁRIOS ─────────────────────── */

function fmtBRL(v) {
    if (v == null) return '--';
    return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtNum(v) {
    if (v == null) return '--';
    if (v >= 1e12) return (v / 1e12).toFixed(1) + ' tri';
    if (v >= 1e9) return (v / 1e9).toFixed(1) + ' bi';
    if (v >= 1e6) return (v / 1e6).toFixed(1) + ' mi';
    if (v >= 1e3) return (v / 1e3).toFixed(0) + ' mil';
    return v.toLocaleString('pt-BR');
}

function mercadoAberto() {
    const brt = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    return brt.getDay() >= 1 && brt.getDay() <= 5 && brt.getHours() >= 10 && brt.getHours() < 17;
}

function horaAtual() {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/* ─── RENDERIZAÇÃO ────────────────────── */

/** Barra de progresso de carregamento */
function updateLoadingProgress(loaded, total) {
    const grid = document.getElementById('stockGrid');
    if (!grid) return;
    const pct = Math.round(loaded / total * 100);
    grid.innerHTML = `<div class="stock-loading">
        <div class="spinner"></div>
        <span>Carregando cotacoes... ${loaded}/${total}</span>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>`;
}

/** KPI cards: resumo do mercado */
function renderKPIs() {
    const quotes = Object.values(APP.quotes);
    if (!quotes.length) return;

    const positivas = quotes.filter(q => q.changePercent > 0).length;
    const negativas = quotes.filter(q => q.changePercent < 0).length;
    const volumeTotal = quotes.reduce((s, q) => s + (q.volume || 0), 0);

    // Maior alta e maior queda
    const sorted = [...quotes].sort((a, b) => b.changePercent - a.changePercent);
    const maiorAlta = sorted[0];
    const maiorQueda = sorted[sorted.length - 1];

    document.getElementById('kpiGrid').innerHTML = `
        <div class="kpi-card">
            <div class="kpi-label">MAIOR ALTA</div>
            <div class="kpi-value">${maiorAlta.symbol} <span class="kpi-delta up">▲ ${maiorAlta.changePercent.toFixed(2)}%</span></div>
            <div class="kpi-sub">${fmtBRL(maiorAlta.price)}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">MAIOR QUEDA</div>
            <div class="kpi-value">${maiorQueda.symbol} <span class="kpi-delta down">▼ ${Math.abs(maiorQueda.changePercent).toFixed(2)}%</span></div>
            <div class="kpi-sub">${fmtBRL(maiorQueda.price)}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">ACOES MONITORADAS</div>
            <div class="kpi-value"><span style="color:var(--accent-green)">${positivas}▲</span> <span style="color:var(--accent-red)">${negativas}▼</span></div>
            <div class="kpi-sub">${quotes.length} acoes no total</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">VOLUME TOTAL</div>
            <div class="kpi-value">${fmtNum(volumeTotal)}</div>
            <div class="kpi-sub">Atualizado ${horaAtual()}</div>
        </div>
    `;
}

/** Gera mini sparkline SVG a partir de dados históricos */
function sparklineSVG(history, up) {
    if (!history || history.length < 2) return '';
    const closes = history.map(p => p.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;
    const w = 80, h = 28;
    const points = closes.map((v, i) => `${(i / (closes.length - 1) * w).toFixed(1)},${(h - (v - min) / range * h).toFixed(1)}`).join(' ');
    const color = up ? 'var(--accent-green)' : 'var(--accent-red)';
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="sparkline"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
}

/** Grid de cards de ações */
function renderGrid() {
    const grid = document.getElementById('stockGrid');
    let quotes = Object.values(APP.quotes);

    // Filtro setor
    if (APP.filter !== 'todos') {
        quotes = quotes.filter(q => SETOR_MAP[q.symbol] === APP.filter);
    }

    // Busca
    if (APP.search) {
        const s = APP.search.toUpperCase();
        quotes = quotes.filter(q => q.symbol.includes(s) || q.longName.toUpperCase().includes(s));
    }

    // Ordenação
    switch (APP.sort) {
        case 'variacao': quotes.sort((a, b) => b.changePercent - a.changePercent); break;
        case 'preco': quotes.sort((a, b) => b.price - a.price); break;
        case 'volume': quotes.sort((a, b) => (b.volume || 0) - (a.volume || 0)); break;
        case 'nome': quotes.sort((a, b) => a.symbol.localeCompare(b.symbol)); break;
    }

    if (!quotes.length) {
        grid.innerHTML = '<div class="no-results">Nenhuma acao encontrada</div>';
        return;
    }

    grid.innerHTML = quotes.map(q => {
        const up = q.changePercent >= 0;
        const cls = up ? 'up' : 'down';
        const arrow = up ? '▲' : '▼';
        const range52 = q.week52High > q.week52Low
            ? ((q.price - q.week52Low) / (q.week52High - q.week52Low) * 100).toFixed(0) : 50;
        const spark = sparklineSVG(APP.history[q.symbol], up);
        const setor = SETORES[SETOR_MAP[q.symbol]]?.label || '';

        return `<div class="stock-card" onclick="openDetail('${q.symbol}')">
            <div class="stock-logo-fallback">${q.symbol.slice(0, 2)}</div>
            <div class="stock-info">
                <div class="stock-ticker">${q.symbol} <span class="stock-sector-tag">${setor}</span></div>
                <div class="stock-name">${q.longName}</div>
            </div>
            <div class="stock-price-area">
                <div class="stock-price">${fmtBRL(q.price)}</div>
                <div class="stock-var ${cls}">${arrow} ${Math.abs(q.changePercent).toFixed(2)}%</div>
            </div>
            <div class="stock-meta">
                ${spark}
                <div class="stock-meta-item"><span>Vol</span><span class="stock-meta-val">${fmtNum(q.volume)}</span></div>
                <div class="range-bar"><div class="range-fill" style="width:100%"></div><div class="range-dot" style="left:${range52}%"></div></div>
            </div>
        </div>`;
    }).join('');
}

/** Abre detalhes com gráfico TradingView */
function openDetail(ticker) {
    const q = APP.quotes[ticker];
    const hist = APP.history[ticker];
    if (!q) return;

    const up = q.changePercent >= 0;
    const cls = up ? 'up' : 'down';
    const overlay = document.getElementById('detailOverlay');
    const card = document.getElementById('detailCard');

    card.innerHTML = `
        <div class="detail-header">
            <div>
                <div class="detail-ticker">${q.symbol}</div>
                <div class="detail-name">${q.longName}</div>
            </div>
            <button class="detail-close" onclick="closeDetail()">&times;</button>
        </div>
        <div class="detail-price">${fmtBRL(q.price)}</div>
        <div class="detail-var ${cls}">${up ? '▲' : '▼'} ${fmtBRL(Math.abs(q.change))} (${Math.abs(q.changePercent).toFixed(2)}%)</div>
        <div class="detail-chart" id="detailChartContainer"></div>
        <div class="detail-grid">
            <div class="detail-item"><div class="detail-item-label">Fech. Anterior</div><div class="detail-item-value">${fmtBRL(q.prevClose)}</div></div>
            <div class="detail-item"><div class="detail-item-label">Volume</div><div class="detail-item-value">${fmtNum(q.volume)}</div></div>
            <div class="detail-item"><div class="detail-item-label">Min 52 sem</div><div class="detail-item-value">${fmtBRL(q.week52Low)}</div></div>
            <div class="detail-item"><div class="detail-item-label">Max 52 sem</div><div class="detail-item-value">${fmtBRL(q.week52High)}</div></div>
            ${q.marketCap ? `<div class="detail-item"><div class="detail-item-label">Market Cap</div><div class="detail-item-value">${fmtNum(q.marketCap)}</div></div>` : ''}
        </div>
    `;

    overlay.classList.add('open');

    // Gráfico com dados reais
    if (hist?.length && typeof LightweightCharts !== 'undefined') {
        const container = document.getElementById('detailChartContainer');
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

        const color = up ? '#3fb950' : '#f85149';
        const series = chart.addAreaSeries({
            lineColor: color,
            topColor: color + '30',
            bottomColor: color + '05',
            lineWidth: 2,
        });

        series.setData(hist.map(p => ({ time: p.date, value: p.close })));
        chart.timeScale().fitContent();
    }
}

function closeDetail() {
    document.getElementById('detailOverlay').classList.remove('open');
}

/* ─── STATUS ──────────────────────────── */

function updateStatus() {
    const badge = document.getElementById('statusBadge');
    const ts = document.getElementById('lastUpdate');
    if (mercadoAberto()) {
        badge.textContent = 'LIVE'; badge.className = 'header-badge live';
    } else {
        badge.textContent = 'FECHADO'; badge.className = 'header-badge closed';
    }
    ts.textContent = horaAtual();
}

/* ─── POLLING ─────────────────────────── */

async function pollCycle() {
    updateStatus();
    const tickers = [...ALL_TICKERS, ...APP.customTickers];
    await fetchAll(tickers);
    renderKPIs();
    renderGrid();
    updateStatus();
    APP.loading = false;
}

function startPolling() {
    if (APP.polling) clearInterval(APP.polling);
    APP.polling = setInterval(() => {
        if (mercadoAberto()) pollCycle();
        else updateStatus();
    }, POLL_INTERVAL);
}

/* ─── ADICIONAR AÇÃO ──────────────────── */

function addTicker(ticker) {
    ticker = ticker.toUpperCase().trim();
    if (!ticker || ALL_TICKERS.includes(ticker) || APP.customTickers.includes(ticker)) return;
    APP.customTickers.push(ticker);
    SETOR_MAP[ticker] = 'outros';
    if (!SETORES.outros.tickers.includes(ticker)) SETORES.outros.tickers.push(ticker);
    // Buscar dados
    fetchTicker(ticker).then(data => {
        if (data) {
            APP.quotes[ticker] = data.quote;
            APP.history[ticker] = data.history;
            renderKPIs();
            renderGrid();
        }
    });
}

/* ─── EVENTOS ─────────────────────────── */

function init() {
    // Theme
    const saved = localStorage.getItem('theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);

    document.getElementById('themeToggle').addEventListener('click', () => {
        const h = document.documentElement;
        const isDark = h.getAttribute('data-theme') !== 'light';
        h.setAttribute('data-theme', isDark ? 'light' : 'dark');
        localStorage.setItem('theme', isDark ? 'light' : 'dark');
        document.getElementById('themeToggle').textContent = isDark ? '\u263E' : '\u2606';
    });

    // Filtro setor
    document.querySelectorAll('.pill').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            APP.filter = btn.dataset.sector;
            renderGrid();
        });
    });

    // Busca — Enter para adicionar ticker novo
    const searchEl = document.getElementById('searchInput');
    searchEl.addEventListener('input', () => { APP.search = searchEl.value.trim(); renderGrid(); });
    searchEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && searchEl.value.trim()) {
            addTicker(searchEl.value);
            searchEl.value = '';
            APP.search = '';
        }
    });

    // Ordenação
    document.getElementById('sortSelect').addEventListener('change', (e) => {
        APP.sort = e.target.value;
        renderGrid();
    });

    // Modal
    document.getElementById('detailOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'detailOverlay') closeDetail();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetail(); });

    // Carregar
    updateStatus();
    pollCycle().then(() => startPolling());
}

init();

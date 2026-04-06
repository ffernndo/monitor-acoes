# Monitor de Acoes B3

Dashboard de acompanhamento das principais acoes da Bolsa brasileira com cotacoes atualizadas a cada 60 segundos durante o pregao.

**[Acessar o Monitor](https://fexndev.github.io/monitor-acoes/)**

---

## Funcionalidades

- **20 acoes monitoradas** — PETR4, VALE3, ITUB4, BBDC4, BBAS3 e mais
- **KPI cards** — IBOVESPA, Dolar, acoes em alta/queda, volume total
- **Atualizacao automatica** — polling a cada 60s quando o mercado esta aberto (10h-17h BRT)
- **Filtro por setor** — Bancos, Petroleo, Mineracao, Varejo, Industria
- **Busca por ticker** — filtro em tempo real
- **Ordenacao** — por variacao, preco, volume ou nome
- **Detalhes** — clique no card para ver grafico intraday, P/L, LPA, range 52 semanas
- **Status ao vivo** — badge LIVE/FECHADO com deteccao automatica de horario
- **Dark/light mode** com persistencia

## Setores

| Setor | Acoes |
|-------|-------|
| Bancos | ITUB4, BBDC4, BBAS3, ITSA4, B3SA3 |
| Petroleo/Energia | PETR4, PETR3, PRIO3, CSAN3 |
| Mineracao/Siderurgia | VALE3, SUZB3, GGBR4 |
| Varejo/Consumo | MGLU3, LREN3, ABEV3, RADL3 |
| Industria | WEGE3, RENT3, JBSS3, HAPV3 |

## API

Dados fornecidos por [Brapi.dev](https://brapi.dev) — API gratuita de cotacoes da B3.

- Endpoint: `https://brapi.dev/api/quote/{TICKER}`
- Rate limit: ~1 req/s (requests sequenciais com delay de 300ms)
- Dados: preco, variacao, volume, high/low, market cap, P/L, EPS, range 52 semanas

## Stack

- HTML + CSS + JavaScript vanilla
- TradingView Lightweight Charts (graficos intraday)
- GitHub Pages (deploy estatico)

## Estrutura

```
monitor-acoes/
├── index.html    # Estrutura + CDNs
├── app.js        # API, polling, render, filtros, detalhes
├── styles.css    # Design system dark/light
└── README.md
```

# B3 Stock Monitor

Dashboard that tracks the main stocks on Brazil's stock exchange (B3), with quotes refreshed every 60 seconds during trading hours.

**[Open the monitor](https://fexndev.github.io/monitor-acoes/)**

---

## Features

- **20 tracked stocks**: PETR4, VALE3, ITUB4, BBDC4, BBAS3 and more
- **KPI cards**: IBOVESPA, USD/BRL, stocks up/down, total volume
- **Automatic refresh**: polling every 60s while the market is open (10am to 5pm BRT)
- **Sector filter**: Banks, Oil & Gas, Mining, Retail, Industrials
- **Ticker search**: real-time filter
- **Sorting**: by change, price, volume or name
- **Details**: click a card to see the intraday chart, P/E, EPS and 52-week range
- **Live status**: LIVE/CLOSED badge with automatic market-hours detection
- **Dark/light mode** with persistence

## Sectors

| Sector | Stocks |
|--------|--------|
| Banks | ITUB4, BBDC4, BBAS3, ITSA4, B3SA3 |
| Oil & Gas / Energy | PETR4, PETR3, PRIO3, CSAN3 |
| Mining & Steel | VALE3, SUZB3, GGBR4 |
| Retail & Consumer | MGLU3, LREN3, ABEV3, RADL3 |
| Industrials | WEGE3, RENT3, JBSS3, HAPV3 |

## API

Data provided by [Brapi.dev](https://brapi.dev), a free API for B3 quotes.

- Endpoint: `https://brapi.dev/api/quote/{TICKER}`
- Rate limit: ~1 req/s (sequential requests with a 300ms delay)
- Data: price, change, volume, high/low, market cap, P/E, EPS, 52-week range

## Stack

- HTML + CSS + vanilla JavaScript
- TradingView Lightweight Charts (intraday charts)
- GitHub Pages (static deploy)

## Structure

```
monitor-acoes/
├── index.html    # Structure + CDNs
├── app.js        # API, polling, rendering, filters, details
├── styles.css    # Dark/light design system
└── README.md
```

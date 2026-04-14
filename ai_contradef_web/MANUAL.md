# MANUAL — AI Contradef Web Dashboard

## 1. Objetivo

Este manual explica como executar localmente a plataforma web de análise de malware em tempo real e conectá-la ao pipeline já desenvolvido com `AITimingModule.cpp`, `AIAnalyzer.py` e `AIWebBridge.py`. O foco operacional é permitir que o analista observe o comportamento da amostra em execução, acompanhe anomalias de timing e consolide relatórios interpretáveis no dashboard.

## 2. Fluxo Operacional

O fluxo completo de execução local é composto por quatro processos complementares.

| Etapa | Componente | Responsabilidade |
| --- | --- | --- |
| 1 | `AITimingModule.cpp` | Instrumenta a amostra com Intel Pin e coleta chamadas de função. |
| 2 | `AIAnalyzer.py` | Analisa os eventos recebidos via Named Pipe e calcula detecções. |
| 3 | `AIWebBridge.py` | Converte o resultado analítico em eventos compatíveis com a API web. |
| 4 | `ai_contradef_web` | Exibe sessões, alertas, anomalias, fluxo e relatórios em tempo real. |

## 3. Execução Local

### 3.1. Subir a aplicação web

```bash
cd C:\AI_contradef_web
pnpm install
pnpm db:push
pnpm dev
```

### 3.2. Iniciar o analisador Python

```bash
cd C:\AI_contradef
python AIAnalyzer.py
```

### 3.3. Conectar o bridge ao dashboard

```bash
cd C:\AI_contradef
python AIWebBridge.py --dashboard-url http://localhost:3000 --sample-name target.exe --session-key sessao-demo
```

### 3.4. Executar o Contradef com o PinTool

```bash
"C:\pin\pin.exe" -t "C:\AI_contradef\AITimingModule.dll" -- "C:\AI_contradef\target.exe"
```

## 4. O que observar no dashboard

A página principal apresenta os logs com os campos **TID**, **StartTime**, **FunctionName**, **ModuleName** e **DurationTicks**, além dos seguintes módulos analíticos:

| Módulo | Interpretação |
| --- | --- |
| Sessão em foco | Resume a amostra ativa, o estado da execução e a classe predominante detectada. |
| Fluxo de execução | Mostra o caminho percorrido pelas funções e a categoria operacional associada. |
| Detecções | Consolida classes **Benigno**, **Anti-Debugging**, **Anti-VM**, **Injeção de Código** e **Ofuscação** com confiança. |
| Timing monitor | Realça eventos de `GetTickCount`, `QueryPerformanceCounter` e `GetSystemTimeAsFileTime`. |
| Histórico | Mantém sessões anteriores e permite exportação JSON. |
| Relatório narrativo | Gera um texto explicativo sobre comportamento, técnica evasiva e mitigação. |

## 5. Alertas de Alta Severidade

Quando o backend recebe uma classificação **Anti-VM** ou **Injeção de Código**, a plataforma gera alerta automático para o analista. Esses alertas também podem ser usados como gatilho para procedimentos internos de resposta ou triagem priorizada.

## 6. Exportação e Evidência

Cada sessão pode ser exportada em JSON a partir do próprio dashboard. O pacote exportado consolida metadados da sessão, logs coletados, detecções, alertas e sumarização quantitativa das APIs observadas.

## 7. Testes da Plataforma

```bash
cd /home/ubuntu/ai_contradef_web
pnpm check
pnpm test
```

## 8. Vídeo Explicativo

O repositório principal do agente inclui o arquivo `AI_contradef_local_runbook.mp4`, que demonstra visualmente a sequência de execução local descrita neste manual.

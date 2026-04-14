# AI Contradef Web Dashboard

A plataforma **AI Contradef Web Dashboard** transforma os sinais produzidos pelo agente híbrido em **C++ + Python** em uma experiência de observabilidade para analistas de segurança. O objetivo é oferecer uma camada visual e interpretável sobre a análise de malware em tempo real, exibindo chamadas instrumentadas, anomalias temporais, fluxo de execução, classificações de técnicas evasivas e relatórios narrativos produzidos por um modelo de linguagem.

## Visão do Produto

O dashboard foi desenhado para cenários em que o malware é instrumentado pelo **Contradef/PinTool** e os resultados são analisados pelo **AIAnalyzer.py**. A aplicação web recebe os eventos já correlacionados a partir do backend em tempo real, preservando os campos operacionais exigidos pelo fluxo analítico: **TID**, **StartTime**, **FunctionName**, **ModuleName** e **DurationTicks**.

A interface foi concebida como um painel profissional de operações de segurança, com foco em leitura rápida, hierarquia visual clara e apoio à tomada de decisão durante sessões dinâmicas de análise.

## Funcionalidades Implementadas

| Componente | Descrição |
| --- | --- |
| Dashboard em tempo real | Exibe eventos instrumentados com os campos exatos solicitados: **TID**, **StartTime**, **FunctionName**, **ModuleName** e **DurationTicks**. |
| Fluxo de execução | Mostra o caminho percorrido pelas funções categorizadas em classes como **Anti-Debugging**, **Anti-Timing**, **Memory Manipulation** e **Dynamic Loading**. |
| Painel de detecção | Consolida as classificações da IA nas classes **Benigno**, **Anti-Debugging**, **Anti-VM**, **Injeção de Código** e **Ofuscação**, com confiança percentual. |
| Tabela quantitativa | Resume as APIs observadas com **contagem**, **categoria** e **descrição operacional**. |
| Timing monitor | Sinaliza anomalias nas funções **GetTickCount**, **QueryPerformanceCounter** e **GetSystemTimeAsFileTime**. |
| Histórico de sessões | Mantém sessões anteriores com foco em revisão, comparação e exportação JSON. |
| Alertas automáticos | Gera sinalização imediata para eventos de maior severidade, em especial **Anti-VM** e **Injeção de Código**. |
| Relatórios narrativos | Usa um modelo de linguagem para explicar comportamento observado, técnicas evasivas detectadas e recomendações de mitigação. |
| Stream em tempo real | O backend usa **SSE** para distribuir snapshots ao frontend de forma contínua. |
| Ponte de integração | O backend suporta ingestão por **HTTP** e uma ponte opcional via **Named Pipe** para alinhamento com o fluxo local do AIAnalyzer.py. |

## Arquitetura Resumida

A arquitetura foi dividida em três camadas. A primeira é a **camada de coleta**, composta pelo PinTool em **C++**, que instrumenta APIs sensíveis e mede duração das chamadas. A segunda é a **camada analítica**, materializada no **AIAnalyzer.py**, responsável por consolidar eventos, extrair características, detectar padrões evasivos e produzir classificações. A terceira é a **camada de observabilidade**, construída nesta aplicação web, que recebe os eventos, persiste sessões, emite alertas, gera relatórios e apresenta o resultado em tempo real.

```text
AITimingModule.cpp -> AIAnalyzer.py -> AIWebBridge.py / Named Pipe bridge -> Web backend -> SSE -> Frontend
```

## Estrutura Técnica

| Diretório | Finalidade |
| --- | --- |
| `client/` | Interface React com dashboard em tempo real, gráficos, tabelas e relatórios. |
| `server/` | Backend Express + tRPC com ingestão, persistência, exportação e geração narrativa. |
| `drizzle/` | Modelagem de sessões, eventos, detecções, alertas e relatórios. |
| `todo.md` | Registro rastreável das funcionalidades implementadas e pendentes. |

## Execução Local da Plataforma Web

### 1. Instalação

```bash
cd /home/ubuntu/ai_contradef_web
pnpm install
```

### 2. Banco e ambiente

O template já fornece autenticação e banco de dados gerenciados pela plataforma. Para aplicar o schema local:

```bash
pnpm db:push
```

### 3. Subir o dashboard

```bash
pnpm dev
```

A interface ficará disponível na URL local indicada pelo servidor. Em desenvolvimento dentro do ambiente Manus, a URL pública temporária é exibida automaticamente no painel do projeto.

## Integração com o Agente Existente

Para integrar com o projeto já desenvolvido em `/home/ubuntu/AI_contradef`, utilize o script `AIWebBridge.py`, que consome o `AIAnalyzer.py` e encaminha eventos para o dashboard.

### Exemplo de uso

```bash
cd C:\AI_contradef
python AIWebBridge.py --dashboard-url http://localhost:3000 --sample-name target.exe --session-key sessao-demo
```

Esse fluxo pressupõe que o módulo de instrumentação esteja encaminhando eventos ao `AIAnalyzer.py`. O bridge traduz os eventos para o contrato esperado pelo backend web e publica os dados em `/api/runtime/ingest`.

## Endpoints e Contratos

| Endpoint / Procedimento | Objetivo |
| --- | --- |
| `GET /api/runtime/stream` | Stream SSE com snapshots atualizados em tempo real. |
| `POST /api/runtime/ingest` | Recebe eventos estruturados do pipeline analítico. |
| `runtime.sessions` | Lista sessões recentes para o dashboard. |
| `runtime.overview` | Retorna indicadores executivos agregados. |
| `runtime.exportJson` | Exporta uma sessão consolidada em JSON. |
| `runtime.generateNarrative` | Solicita relatório narrativo com apoio de modelo de linguagem. |

## Testes

Os testes automatizados validam autenticação, listagem de sessões, ingestão do pipeline e exportação JSON:

```bash
pnpm test
pnpm check
```

## Próximos Passos Recomendados

A plataforma já está pronta para demonstração e evolução incremental. Como próximos passos, vale considerar autenticação de dispositivos locais, assinatura criptográfica dos eventos recebidos do bridge, versionamento de modelos de classificação e dashboards comparativos entre múltiplas campanhas de malware.

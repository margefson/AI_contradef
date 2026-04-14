# Roteiro do Vídeo — Execução Local do AI Contradef com Dashboard Web

## Objetivo

Este vídeo demonstra como subir localmente o agente de IA integrado ao Contradef e conectar a análise em tempo real ao dashboard web. O fluxo mostrado acompanha o manual atualizado e destaca os papéis do `AITimingModule.cpp`, do `AIAnalyzer.py`, do `AIWebBridge.py` e da aplicação `AI Contradef Web Dashboard`.

## Estrutura Narrativa

### Cena 1 — Abertura e contexto

**Visual sugerido:** tela inicial do dashboard, seguida por um diagrama simples do fluxo `Contradef -> AIAnalyzer.py -> AIWebBridge.py -> Dashboard Web`.

**Narração:**

> Nesta demonstração, vamos subir localmente o AI Contradef com a nova plataforma web de monitoramento em tempo real. O objetivo é capturar chamadas de função do malware, identificar técnicas evasivas e apresentar tudo de forma interpretável para o analista.

### Cena 2 — Pré-requisitos

**Visual sugerido:** lista em tela com Windows, Intel Pin, Visual Studio, Python, Git e Node.js/pnpm.

**Narração:**

> Antes de começar, confirme que o ambiente possui Windows x64, Intel Pin, Visual Studio com C++, Python 3, Git e Node.js com pnpm. Também é necessário ter os repositórios `AI_contradef` e `ai_contradef_web` disponíveis localmente.

### Cena 3 — Subindo o AIAnalyzer.py

**Visual sugerido:** terminal mostrando:

```bash
cd C:\AI_contradef
python AIAnalyzer.py
```

**Narração:**

> No primeiro terminal, iniciamos o AIAnalyzer. Ele escuta os eventos vindos do módulo de instrumentação, acumula os logs e calcula as classificações comportamentais do malware.

### Cena 4 — Subindo o dashboard web

**Visual sugerido:** terminal mostrando:

```bash
cd C:\AI_contradef_web
pnpm install
pnpm db:push
pnpm dev
```

**Narração:**

> Em seguida, subimos a aplicação web. É ela que vai exibir os logs em tempo real, o fluxo de execução, os alertas críticos, as anomalias de timing e os relatórios narrativos.

### Cena 5 — Conectando o bridge

**Visual sugerido:** terminal mostrando:

```bash
cd C:\AI_contradef
python AIWebBridge.py --dashboard-url http://localhost:3000 --sample-name target.exe --session-key sessao-demo
```

**Narração:**

> No terceiro terminal, executamos o AIWebBridge. Ele observa o buffer do AIAnalyzer, normaliza as classificações e encaminha logs, detecções e alertas para o backend do dashboard.

### Cena 6 — Executando o Contradef com o PinTool

**Visual sugerido:** terminal mostrando:

```bash
"C:\pin\pin.exe" -t "C:\AI_contradef\AITimingModule.dll" -- "C:\AI_contradef\target.exe"
```

**Narração:**

> Agora executamos a amostra instrumentada pelo Contradef. O PinTool coleta o identificador da thread, o tempo de início, o nome da função, o módulo e a duração da chamada. Esses dados alimentam o AIAnalyzer e, em seguida, o dashboard web.

### Cena 7 — Leitura do dashboard

**Visual sugerido:** foco em cada módulo da interface.

**Narração:**

> No painel principal, os logs aparecem com os campos TID, StartTime, FunctionName, ModuleName e DurationTicks. O fluxo de execução mostra o caminho percorrido pelas funções monitoradas. O painel de detecção apresenta as classes Benigno, Anti-Debugging, Anti-VM, Injeção de Código e Ofuscação com confiança percentual. As funções GetTickCount, QueryPerformanceCounter e GetSystemTimeAsFileTime recebem monitoramento especial para anomalias temporais.

### Cena 8 — Alertas e relatórios

**Visual sugerido:** alerta de alta severidade e botão de geração narrativa.

**Narração:**

> Quando a IA detecta Anti-VM ou Injeção de Código, o sistema gera alertas automáticos. O analista também pode exportar a sessão em JSON e solicitar um relatório narrativo com contexto técnico e recomendações de mitigação.

### Cena 9 — Encerramento

**Visual sugerido:** tela final com os repositórios e os arquivos principais.

**Narração:**

> Com esse fluxo, o AI Contradef passa a oferecer não apenas detecção, mas também interpretabilidade operacional. O analista acompanha o comportamento do malware em tempo real, entende as técnicas evasivas utilizadas e documenta a sessão com muito mais precisão.

## Observações de Produção

O vídeo final pode ser gerado como uma sequência de slides narrados ou como uma gravação guiada da execução local. Em ambos os casos, o conteúdo deve seguir exatamente esta ordem para permanecer consistente com o `MANUAL.md`.

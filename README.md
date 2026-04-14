# AI_contradef: Agente de IA para Análise de Técnicas Evasivas de Malware

Este repositório contém um agente de Inteligência Artificial (IA) projetado para se integrar à ferramenta de instrumentação binária dinâmica (DBI) Contradef. O objetivo principal é aprimorar a capacidade do Contradef de detectar e analisar técnicas evasivas empregadas por malwares em executáveis Windows x64, focando na medição de tempo de execução de funções, logging detalhado e categorização de chamadas de forma furtiva.

## Funcionalidades e Objetivos das Melhorias

As melhorias implementadas neste projeto visam transformar o Contradef em uma ferramenta mais inteligente e adaptável para a análise de malwares, permitindo a detecção de comportamentos evasivos que dependem de timing ou sequências complexas de chamadas de API.

### 1. IPC (Interprocess Communication) via Named Pipes Refinado

**Funcionalidade:** A comunicação entre o módulo de instrumentação em C++ (PinTool) e o módulo de análise de IA em Python foi refinada para utilizar Named Pipes de forma mais robusta. Isso estabelece canais de comunicação bidirecionais eficientes e em tempo real para dados de instrumentação e comandos de feedback.

**Objetivo:** Garantir a transmissão instantânea e confiável dos dados de instrumentação para o módulo de IA, e a recepção de comandos de feedback pelo PinTool, minimizando a latência e otimizando a interação para detecção de técnicas evasivas em tempo de execução.

### 2. Modelo de IA Aprimorado com Características Robustas e Lógica de `GetTickCount`

**Funcionalidade:** O módulo `AIAnalyzer.py` agora incorpora um modelo de Machine Learning (Random Forest) treinado com um conjunto ainda mais rico de características. Além da duração média e variância das chamadas de função, o modelo considera a frequência e o contexto de chamadas a APIs sensíveis relacionadas a:
*   **Anti-Debugging:** `IsDebuggerPresent`, `CheckRemoteDebuggerPresent`, `NtQueryInformationProcess`.
*   **Manipulação de Memória:** `VirtualAlloc`, `VirtualAllocEx`, `WriteProcessMemory`, `ReadProcessMemory`, `MapViewOfFile`.
*   **Criação/Manipulação de Processos/Threads:** `CreateProcess`, `OpenProcess`, `TerminateProcess`, `CreateRemoteThread`, `NtCreateThreadEx`.
*   **Acesso ao Registro:** `RegOpenKey`, `RegQueryValue`, `RegSetValue`, `NtOpenKey`, `NtQueryValueKey`.
*   **APIs de Timing (incluindo `GetTickCount`):** `GetTickCount`, `GetTickCount64`, `QueryPerformanceCounter`, `timeGetTime`.

Uma lógica específica foi adicionada para detectar anomalias no uso de `GetTickCount` e outras APIs de timing, incluindo:
    *   **Loops de Timing**: Detecção de chamadas muito frequentes a APIs de timing em curtos intervalos, indicando tentativas de medir o tempo de forma evasiva.
    *   **Anomalias de Duração**: Identificação de durações anormalmente altas para chamadas de `GetTickCount` (que deveriam ser rápidas), sugerindo a presença de instrumentação ou *overhead* de análise.
    *   **Padrões de Sleep Intercalados**: Detecção de sequências onde chamadas de timing são intercaladas com funções de `Sleep`, um padrão comum para verificar a aceleração de tempo em ambientes de sandbox.
O modelo agora considera essas características temporais detalhadas para uma detecção mais precisa e contextualizada.

**Objetivo:** Aumentar significativamente a precisão e a capacidade do agente de IA em categorizar diferentes tipos de técnicas evasivas, especialmente aquelas que exploram anomalias temporais, fornecendo uma análise mais granular e contextualizada.

### 3. Mecanismo de Feedback Dinâmico Aprimorado

**Funcionalidade:** O mecanismo de feedback foi aprimorado para garantir maior robustez e responsividade. O módulo C++ (`AITimingModule.cpp`) agora verifica periodicamente por comandos do `AIAnalyzer.py` através de um Named Pipe dedicado, utilizando uma leitura não-bloqueante (`PeekNamedPipe`) para evitar interrupções na instrumentação. Além disso, foi implementado um tratamento de erros para `WriteFile` no pipe de dados, permitindo que o PinTool detecte e lide com pipes quebrados, invalidando o handle e evitando *crashes*. Isso permite que o agente de IA ajuste a granularidade da instrumentação em tempo real. Por exemplo, se o módulo de IA detectar um comportamento altamente suspeito (e.g., anomalias de timing), ele pode enviar um comando (`TRACE_ALL_ON`) para o PinTool, instruindo-o a instrumentar todas as funções, aumentando a granularidade da coleta de dados para uma análise mais aprofundada. Mensagens de console foram adicionadas para indicar quando o rastreamento completo é ativado ou desativado.

**Objetivo:** Otimizar o *overhead* de instrumentação e aumentar a adaptabilidade do sistema. Em cenários normais, o PinTool pode focar apenas em APIs sensíveis. No entanto, ao detectar anomalias, o agente de IA pode dinamicamente solicitar uma instrumentação mais abrangente, garantindo que nenhum comportamento evasivo seja perdido, sem comprometer desnecessariamente a performance em situações benignas. A verificação periódica do feedback garante uma resposta mais ágil às detecções da IA.

## Estrutura do Repositório

*   `AITimingModule.cpp`: O código-fonte do PinTool em C++ que realiza a instrumentação, coleta de timing e comunicação via Named Pipes.
*   `AIAnalyzer.py`: O script Python que implementa o servidor de Named Pipe, o modelo de IA para análise e categorização, e o mecanismo de feedback.
*   `AI_Agent_Integration.py`: Um script Python de orquestração que demonstra como iniciar o `AIAnalyzer.py` e executar o Contradef com o PinTool.
*   `integration_test.py`: Um script de teste para validar a comunicação via Named Pipes e o fluxo de feedback entre os módulos Python.
*   `MANUAL.md`: Um manual detalhado com instruções passo a passo para configurar, compilar, executar e testar o agente de IA localmente no ambiente Windows.

## Como Começar

Para instruções detalhadas sobre como configurar o ambiente, compilar o PinTool, instalar as dependências Python e executar o agente de IA, por favor, consulte o arquivo [`MANUAL.md`](./MANUAL.md).

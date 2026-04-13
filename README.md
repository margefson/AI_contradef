# AI_contradef: Agente de IA para Análise de Técnicas Evasivas de Malware

Este repositório contém um agente de Inteligência Artificial (IA) projetado para se integrar à ferramenta de instrumentação binária dinâmica (DBI) Contradef. O objetivo principal é aprimorar a capacidade do Contradef de detectar e analisar técnicas evasivas empregadas por malwares em executáveis Windows x64, focando na medição de tempo de execução de funções, logging detalhado e categorização de chamadas de forma furtiva.

## Funcionalidades e Objetivos das Melhorias

As melhorias implementadas neste projeto visam transformar o Contradef em uma ferramenta mais inteligente e adaptável para a análise de malwares, permitindo a detecção de comportamentos evasivos que dependem de timing ou sequências complexas de chamadas de API.

### 1. IPC (Interprocess Communication) via Named Pipes

**Funcionalidade:** A comunicação entre o módulo de instrumentação em C++ (PinTool) e o módulo de análise de IA em Python agora é realizada através de Named Pipes. Isso estabelece um canal de comunicação eficiente e em tempo real entre os dois componentes.

**Objetivo:** Permitir que os dados de instrumentação (informações sobre chamadas de função, seus tempos de execução, etc.) sejam transmitidos instantaneamente do ambiente instrumentado para o módulo de IA para análise. Isso é crucial para a detecção de técnicas evasivas em tempo de execução, onde a latência mínima é essencial.

### 2. Modelo de IA Aprimorado com Características Robustas

**Funcionalidade:** O módulo `AIAnalyzer.py` agora incorpora um modelo de Machine Learning (Random Forest) treinado com um conjunto mais rico de características. Além da duração média e variância das chamadas de função, o modelo considera a frequência e o contexto de chamadas a APIs sensíveis relacionadas a:
*   **Anti-Debugging:** `IsDebuggerPresent`, `CheckRemoteDebuggerPresent`, `NtQueryInformationProcess`.
*   **Manipulação de Memória:** `VirtualAlloc`, `VirtualAllocEx`, `WriteProcessMemory`, `ReadProcessMemory`, `MapViewOfFile`.
*   **Criação/Manipulação de Processos/Threads:** `CreateProcess`, `OpenProcess`, `TerminateProcess`, `CreateRemoteThread`, `NtCreateThreadEx`.
*   **Acesso ao Registro:** `RegOpenKey`, `RegQueryValue`, `RegSetValue`, `NtOpenKey`, `NtQueryValueKey`.

**Objetivo:** Aumentar a precisão e a capacidade do agente de IA em categorizar diferentes tipos de técnicas evasivas (e.g., Anti-Debugging por timing, injeção de código, ofuscação, Anti-VM/Sandbox) com base em padrões de comportamento mais complexos e contextuais.

### 3. Mecanismo de Feedback Dinâmico

**Funcionalidade:** O módulo C++ (`AITimingModule.cpp`) é capaz de receber comandos de feedback do `AIAnalyzer.py` através de um Named Pipe dedicado. Por exemplo, se o módulo de IA detectar um comportamento altamente suspeito, ele pode enviar um comando (`TRACE_ALL_ON`) para o PinTool, instruindo-o a instrumentar todas as funções, aumentando a granularidade da coleta de dados para uma análise mais aprofundada.

**Objetivo:** Otimizar o *overhead* de instrumentação. Em cenários normais, o PinTool pode focar apenas em APIs sensíveis. No entanto, ao detectar anomalias, o agente de IA pode dinamicamente solicitar uma instrumentação mais abrangente, garantindo que nenhum comportamento evasivo seja perdido, sem comprometer desnecessariamente a performance em situações benignas.

## Estrutura do Repositório

*   `AITimingModule.cpp`: O código-fonte do PinTool em C++ que realiza a instrumentação, coleta de timing e comunicação via Named Pipes.
*   `AIAnalyzer.py`: O script Python que implementa o servidor de Named Pipe, o modelo de IA para análise e categorização, e o mecanismo de feedback.
*   `AI_Agent_Integration.py`: Um script Python de orquestração que demonstra como iniciar o `AIAnalyzer.py` e executar o Contradef com o PinTool.
*   `integration_test.py`: Um script de teste para validar a comunicação via Named Pipes e o fluxo de feedback entre os módulos Python.
*   `MANUAL.md`: Um manual detalhado com instruções passo a passo para configurar, compilar, executar e testar o agente de IA localmente no ambiente Windows.

## Como Começar

Para instruções detalhadas sobre como configurar o ambiente, compilar o PinTool, instalar as dependências Python e executar o agente de IA, por favor, consulte o arquivo [`MANUAL.md`](./MANUAL.md).

# Manual de Configuração, Execução e Teste do Agente de IA para Contradef

Este manual detalha os passos necessários para configurar, executar e testar o agente de Inteligência Artificial (IA) integrado ao Contradef, uma ferramenta de instrumentação binária dinâmica (DBI) baseada no Intel Pin. O agente de IA aprimora a detecção de técnicas evasivas de malware através da análise de tempo de execução de funções, logging detalhado e categorização de chamadas, operando de forma furtiva no ambiente Windows.

## 1. Introdução

O projeto visa estender as capacidades do Contradef, permitindo uma análise mais profunda do comportamento de malwares. O agente de IA monitora as chamadas de função, mede seus tempos de execução e utiliza um modelo de Machine Learning para identificar padrões evasivos. A comunicação entre o módulo de instrumentação (C++) e o módulo de análise (Python) é realizada via Named Pipes, permitindo feedback dinâmico para ajustar a instrumentação.

## 2. Pré-requisitos

Para configurar e executar o agente de IA, você precisará dos seguintes softwares e ferramentas:

*   **Sistema Operacional**: Windows (x64) - O Contradef e o Intel Pin são projetados para este ambiente.
*   **Intel Pin**: A plataforma de instrumentação dinâmica. Baixe a versão mais recente para Windows x64 no site oficial da Intel.
    *   [Intel Pin Homepage](https://software.intel.com/content/www/us/en/develop/articles/pin-a-dynamic-binary-instrumentation-tool.html)
*   **Visual Studio**: Para compilar o módulo C++ (`AITimingModule.cpp`) como um PinTool. Recomenda-se Visual Studio 2019 ou superior com o desenvolvimento de desktop com C++ instalado.
*   **Python 3.x**: Para o módulo de análise de IA e o script de integração. Baixe e instale a versão mais recente.
    *   [Python Official Website](https://www.python.org/downloads/windows/)
*   **Git**: Para clonar o repositório.
    *   [Git Official Website](https://git-scm.com/download/win)
*   **Dependências Python**: `pandas` e `scikit-learn`.

## 3. Configuração do Ambiente

Siga os passos abaixo para configurar seu ambiente de desenvolvimento e execução.

### 3.1. Clonar o Repositório

Abra um terminal (Git Bash, PowerShell ou Prompt de Comando) e clone o repositório do projeto:

```bash
git clone https://github.com/margefson/AI_contradef.git C:\AI_contradef
cd C:\AI_contradef
```

### 3.2. Configurar o Intel Pin

1.  Extraia o conteúdo do arquivo ZIP do Intel Pin para um diretório de sua escolha, por exemplo, `C:\pin`.
2.  Defina a variável de ambiente `PIN_ROOT` apontando para este diretório. Por exemplo, `C:\pin`.

### 3.3. Configurar o Ambiente de Desenvolvimento C++ (Visual Studio)

1.  Abra o Visual Studio.
2.  Crie um novo projeto de 
projeto de biblioteca dinâmica (DLL) vazio.
3.  Adicione os arquivos `AITimingModule.cpp` e `AITimingModule.h` (se criado) ao projeto.
4.  Configure as propriedades do projeto para incluir os diretórios do Intel Pin (`$(PIN_ROOT)\source\include\pin` e `$(PIN_ROOT)\source\include\pin\gen`).
5.  Configure as propriedades do vinculador para incluir as bibliotecas do Intel Pin (`$(PIN_ROOT)\ia32\lib\pin.lib` e `$(PIN_ROOT)\ia32\lib\pinvm.lib` para 32-bit, ou `$(PIN_ROOT)\intel64\lib\pin.lib` e `$(PIN_ROOT)\intel64\lib\pinvm.lib` para 64-bit).
6.  Certifique-se de que o projeto compile para uma DLL (PinTool).
7.  Compile o projeto. O arquivo de saída será `AITimingModule.dll` (ou similar), que é o PinTool.

### 3.4. Instalar Dependências Python

Abra um terminal e navegue até o diretório do projeto:

```bash
cd C:\AI_contradef
pip install pandas scikit-learn
```

## 4. Componentes do Agente de IA

### 4.1. `AITimingModule.cpp` (Módulo C++ - PinTool)

Este é o componente de instrumentação que roda com o Intel Pin. Ele:

*   Injeta *hooks* em chamadas de função (APIs) para registrar o tempo de início e fim de sua execução.
*   Utiliza `QueryPerformanceCounter` para obter *timestamps* de alta precisão.
*   Envia os dados coletados (TID, StartTime, FunctionName, ModuleName, Duration) para o módulo Python via Named Pipe (`\\.\pipe\AIContradefPipe`).
    *   Recebe comandos de feedback do módulo Python via outro Named Pipe (`\\.\pipe\AIContradefPipe_feedback`) para ajustar dinamicamente a instrumentação (e.g., `TRACE_ALL_ON` para instrumentar todas as funções, `TRACE_ALL_OFF` para instrumentar apenas APIs sensíveis). A verificação de feedback é realizada periodicamente de forma não-bloqueante (`PeekNamedPipe`) para uma resposta mais ágil, minimizando o impacto na performance do PinTool. O tratamento de erros para escrita no pipe de dados foi aprimorado para lidar com pipes quebrados, invalidando o handle e evitando *crashes*.
*   Implementa uma lógica de instrumentação seletiva, focando em APIs sensíveis por padrão, mas expandindo a cobertura com base no feedback da IA para manter o mínimo *overhead* e evitar detecção.

### 4.2. `AIAnalyzer.py` (Módulo Python - Análise de IA)

Este script Python é o cérebro do agente de IA. Ele:

*   Cria um servidor de Named Pipe para receber dados em tempo real do `AITimingModule.cpp` e um pipe de feedback para enviar comandos.
*   Acumula os dados em um buffer e os processa periodicamente.
*   Extrai características robustas dos dados, incluindo:
    *   Duração média e variância das chamadas de função.
    *   Frequência de APIs sensíveis (anti-debugging, memória, processo, registro).
    *   Lógica específica e aprimorada para detecção de anomalias no uso de APIs de timing como `GetTickCount`, `QueryPerformanceCounter` e `GetSystemTimeAsFileTime`. Isso inclui a identificação de:
        *   **Loops de Timing**: Chamadas muito frequentes a APIs de timing em curtos intervalos.
        *   **Anomalias de Duração**: Duração anormalmente alta para chamadas de timing, sugerindo instrumentação.
        *   **Padrões de Sleep Intercalados**: Sequências de chamadas de timing intercaladas com funções de `Sleep`, indicando tentativas de detectar ambientes de sandbox.
*   Utiliza um modelo de Machine Learning (Random Forest) para categorizar o comportamento detectado (Benigno, Anti-Debugging, Anti-VM, Injeção de Código, Ofuscação).
*   Envia comandos de feedback para o `AITimingModule.cpp` com base na análise (e.g., se um comportamento suspeito for detectado, pode instruir o PinTool a instrumentar mais agressivamente).

### 4.3. `AI_Agent_Integration.py` (Módulo Python - Orquestração)

Este script Python atua como o orquestrador do sistema. Ele:

*   Inicia o `AIAnalyzer.py` em segundo plano para começar a escutar o Named Pipe.
*   Executa o Intel Pin com o `AITimingModule.dll` e o executável alvo (malware).
*   Simula a interação entre os componentes e demonstra o fluxo de dados e feedback.

### 4.4. `integration_test.py` (Módulo Python - Teste de Integração)

Este script é usado para testar a comunicação entre os módulos C++ e Python, simulando o envio de dados do Contradef e a recepção de feedback pelo módulo C++.

## 5. Execução e Teste Local

Para executar e testar o agente de IA, siga os passos abaixo:

### 5.1. Preparar o Executável Alvo

Coloque o executável que você deseja analisar (por exemplo, um *sample* de malware ou um programa benigno) no diretório `C:\AI_contradef`. Para este manual, vamos assumir que o executável se chama `target.exe`.

### 5.2. Executar o Módulo de Análise de IA (Servidor de Pipe)

Abra um terminal (por exemplo, PowerShell ou Prompt de Comando) e execute o `AIAnalyzer.py`:

```bash
cd C:\AI_contradef
python AIAnalyzer.py
```

Este script iniciará o servidor de Named Pipe e aguardará os dados do Contradef. Deixe este terminal aberto.

### 5.3. Executar o Contradef com o PinTool

Abra um **novo** terminal e execute o Intel Pin com o seu PinTool (`AITimingModule.dll`) e o executável alvo. Certifique-se de substituir `C:\pin\pin.exe` pelo caminho correto do seu executável Pin e `C:\AI_contradef\AITimingModule.dll` pelo caminho do seu PinTool compilado.

```bash
"C:\pin\pin.exe" -t "C:\AI_contradef\AITimingModule.dll" -- "C:\AI_contradef\target.exe"
```

*   **`-t`**: Especifica o PinTool a ser carregado.
*   **`--`**: Separa os argumentos do Pin dos argumentos do executável alvo.

Enquanto o `target.exe` estiver em execução, o `AITimingModule.dll` irá instrumentar as chamadas de função e enviar os dados para o `AIAnalyzer.py` através do Named Pipe. Você deverá ver a saída de análise no terminal onde o `AIAnalyzer.py` está rodando.

### 5.4. Teste de Integração (Opcional)

Para testar apenas a comunicação entre os módulos Python e a lógica de feedback, você pode usar o `integration_test.py`.

1.  Certifique-se de que o `AIAnalyzer.py` **não** esteja rodando (feche o terminal do passo 5.2).
2.  Abra um terminal e execute:

    ```bash
    cd C:\AI_contradef
    python integration_test.py
    ```

Este script simulará o envio de dados do Contradef e demonstrará como o `AIAnalyzer` processa esses dados e envia feedback. Você verá mensagens indicando o envio e recebimento de dados e comandos de feedback.

## 6. Considerações Finais

*   **Performance**: A instrumentação dinâmica pode introduzir um *overhead* de performance. O mecanismo de feedback ajuda a mitigar isso, permitindo que a IA ajuste a granularidade da instrumentação.
*   **Modelo de IA**: O modelo de Machine Learning incluído (`AIAnalyzer.py`) é um exemplo simplificado. Para uso em produção, ele deve ser treinado com um *dataset* real e abrangente de malwares e *softwares* benignos para garantir alta precisão e robustez.
*   **Ambiente de Produção**: Em um ambiente de produção, a comunicação via Named Pipes seria mais robusta e o `AIAnalyzer.py` poderia ser executado como um serviço em segundo plano.

# Smoke Test — Integração AIAnalyzer.py -> AIWebBridge.py -> Dashboard Web

Este teste valida, de ponta a ponta, que o fluxo local entre o pipe do `AIAnalyzer.py`, o `AIWebBridge.py` e o dashboard web está operacional.

## Objetivo

Confirmar que eventos escritos no pipe compartilhado do analisador são processados pelo bridge e publicados com sucesso no backend em tempo real da plataforma web.

## Pré-condições

| Item | Condição |
| --- | --- |
| Dashboard web | Deve estar ativo em `http://127.0.0.1:3000` |
| Dependências Python | `pandas`, `numpy` e `scikit-learn` disponíveis no ambiente do agente |
| Arquivos do agente | `AIAnalyzer.py`, `AIWebBridge.py` e `smoke_test_bridge.py` presentes no repositório |

## Execução

No diretório do agente, execute:

```bash
cd /home/ubuntu/AI_contradef
python3 smoke_test_bridge.py
```

## O que o teste faz

O script realiza o seguinte fluxo:

| Etapa | Ação |
| --- | --- |
| 1 | Inicializa um `AIWebBridge` com a sessão `smoke-session` |
| 2 | Aguarda a criação do pipe `/tmp/AIContradefPipe` |
| 3 | Escreve amostras sintéticas contendo `GetTickCount`, `IsDebuggerPresent` e `QueryPerformanceCounter` |
| 4 | Aguarda o processamento interno do bridge |
| 5 | Consulta o bootstrap do stream SSE do dashboard |
| 6 | Verifica se a sessão apareceu e se o evento `GetTickCount` foi publicado |

## Resultado esperado

Uma execução válida retorna um JSON semelhante a este:

```json
{"status": "ok", "sessionKey": "smoke-session", "functions": ["GetTickCount", "IsDebuggerPresent"], "classification": null}
```

## Interpretação

Esse resultado demonstra que o caminho **pipe -> AIAnalyzer -> AIWebBridge -> backend web -> stream SSE** respondeu corretamente ao estímulo do teste. Mesmo quando a classificação ainda não aparece nessa amostra mínima, a sessão e os logs já são materializados no dashboard, o que comprova a integração funcional do fluxo operacional.

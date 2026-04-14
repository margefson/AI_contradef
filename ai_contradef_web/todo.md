# Project TODO

- [x] Estruturar a plataforma como dashboard profissional para analistas de segurança, com identidade visual elegante e sofisticada.
- [x] Implementar backend em tempo real para receber eventos do AIAnalyzer.py via Named Pipe bridge e transmitir ao frontend por WebSocket ou SSE.
- [x] Modelar persistência de sessões de análise, eventos de função, classificações, alertas e relatórios exportáveis em JSON.
- [x] Exibir dashboard em tempo real com logs contendo exatamente os campos TID, StartTime, FunctionName, ModuleName e DurationTicks.
- [x] Implementar gráfico interativo do fluxo de execução do malware com categorização por técnicas evasivas.
- [x] Exibir painel de detecção de técnicas evasivas com as classes exatamente Benigno, Anti-Debugging, Anti-VM, Injeção de Código e Ofuscação, incluindo nível de confiança.
- [x] Exibir tabela quantitativa das funções chamadas com contagem, categoria e descrição de cada API detectada.
- [x] Implementar indicadores visuais e alertas em tempo real para anomalias de timing em GetTickCount, QueryPerformanceCounter e GetSystemTimeAsFileTime.
- [x] Implementar histórico de sessões com visualização e exportação de relatórios em JSON.
- [x] Enviar notificações automáticas ao analista quando forem detectadas técnicas evasivas de alta severidade, especialmente Anti-VM ou Injeção de Código.
- [x] Integrar modelo de linguagem para geração automática de relatórios narrativos sobre técnicas evasivas, comportamento do malware e recomendações de mitigação.
- [x] Integrar a aplicação web aos códigos-fonte C++ e Python já desenvolvidos no projeto AI_contradef.
- [x] Criar vídeo explicativo baseado no MANUAL.md mostrando como rodar o agente de IA localmente.
- [x] Atualizar MANUAL.md e README.md com instruções da plataforma web, integração em tempo real e vídeo explicativo.
- [x] Escrever testes automatizados do backend e validar os principais fluxos da interface antes da entrega.
- [x] Comitar e enviar todas as modificações para o repositório GitHub do usuário.

- [x] Validar ponta a ponta a ingestão do AIAnalyzer.py para o dashboard web usando o bridge/pipe real e adicionar um smoke test documentado.
- [x] Produzir um vídeo demonstrativo mais completo da execução real, cobrindo o fluxo operacional local de forma visualmente clara.
- [ ] Executar o versionamento final das mudanças do dashboard web e da integração no repositório GitHub do usuário após a validação final.

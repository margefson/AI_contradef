import os
import time
import threading
from AIAnalyzer import AIAnalyzer

def simulate_contradef_data(pipe_name):
    """
    Simula o envio de dados pelo Contradef para o Named Pipe.
    """
    pipe_path = f"/tmp/{pipe_name}"
    # Esperar o pipe ser criado pelo Python
    while not os.path.exists(pipe_path):
        time.sleep(0.1)
    
    print("Simulador: Enviando dados iniciais...")
    with open(pipe_path, 'w') as pipe:
        # Benigno
        pipe.write("1001,1000,GetTickCount,kernel32.dll,100\n")
        pipe.write("1001,1100,RegOpenKey,advapi32.dll,150\n")
        pipe.flush()
        time.sleep(2)
        
        # Suspeito (Anti-Debugging)
        print("Simulador: Enviando dados suspeitos...")
        pipe.write("1001,2000,IsDebuggerPresent,kernel32.dll,8000\n")
        pipe.write("1001,10000,VirtualAlloc,kernel32.dll,2000\n")
        pipe.flush()
        time.sleep(2)

def simulate_feedback_reader(pipe_name):
    """
    Simula o Contradef lendo o pipe de feedback.
    """
    feedback_path = f"/tmp/{pipe_name}_feedback"
    while not os.path.exists(feedback_path):
        time.sleep(0.1)
    
    print("Simulador: Aguardando feedback...")
    while True:
        try:
            with open(feedback_path, 'r') as f:
                for line in f:
                    print(f"Simulador: Recebeu comando de feedback: {line.strip()}")
        except Exception:
            time.sleep(0.1)

if __name__ == "__main__":
    pipe_name = "TestPipe"
    analyzer = AIAnalyzer(pipe_name=pipe_name)
    analyzer.start_pipe_server()
    
    # Iniciar simuladores
    threading.Thread(target=simulate_contradef_data, args=(pipe_name,), daemon=True).start()
    threading.Thread(target=simulate_feedback_reader, args=(pipe_name,), daemon=True).start()
    
    print("Iniciando loop de análise...")
    try:
        for _ in range(5):
            result = analyzer.analyze_realtime()
            if result:
                print(f"Análise: {result['category']} (Confiança: {result['confidence']:.2%})")
                # Se detectar algo suspeito, enviar feedback para instrumentar tudo
                if result['confidence'] > 0.5 and result['category'] != "Benigno":
                    analyzer.send_feedback("TRACE_ALL_ON")
            time.sleep(2)
    finally:
        analyzer.stop()
        print("Teste finalizado.")

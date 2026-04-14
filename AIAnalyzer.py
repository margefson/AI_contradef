import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
import json
import os
import threading
import time

class AIAnalyzer:
    """
    Módulo de IA para análise de técnicas evasivas em tempo de execução.
    Agora com suporte a Named Pipes para IPC e processamento em tempo real.
    """
    
    def __init__(self, pipe_name="AIContradefPipe"):
        self.pipe_name = pipe_name
        self.categories = {
            0: "Benigno",
            1: "Anti-Debugging (Timing)",
            2: "Anti-VM / Sandbox",
            3: "Injeção de Código / Process Hollowing",
            4: "Ofuscação / Empacotamento (Packer)"
        }
        self.model = RandomForestClassifier(n_estimators=100)
        self._train_mock_model()
        self.running = False
        self.data_buffer = []
        self.lock = threading.Lock()

    def _train_mock_model(self):
        """
        Treina um modelo mais robusto com características adicionais.
        X: [avg_dur, var_dur, sens_ratio, mem_cnt, proc_cnt, reg_cnt, time_cnt, time_anom]
        """
        X = np.array([
            [100, 10, 0.05, 0, 0, 0, 0, 0],  # Benigno
            [8000, 2000, 0.6, 1, 0, 0, 10, 1], # Anti-Debugging (Timing)
            [300, 80, 0.8, 0, 1, 1, 5, 0],   # Anti-VM / Sandbox
            [2000, 500, 0.9, 5, 3, 0, 2, 0],  # Injeção de Código
            [1200, 300, 0.4, 2, 0, 0, 1, 0]   # Packer
        ])
        y = np.array([0, 1, 2, 3, 4])
        self.model.fit(X, y)

    def extract_features(self, df):
        """
        Extrai características avançadas do DataFrame de logs, incluindo análise de GetTickCount.
        """
        avg_duration = df['DurationTicks'].mean()
        var_duration = df['DurationTicks'].var()
        
        # Categorias de APIs
        sensitive_apis = ['IsDebuggerPresent', 'CheckRemoteDebuggerPresent', 'NtQueryInformationProcess', 'VirtualProtect']
        memory_apis = ['VirtualAlloc', 'VirtualAllocEx', 'WriteProcessMemory', 'ReadProcessMemory', 'MapViewOfFile']
        process_apis = ['CreateProcess', 'OpenProcess', 'TerminateProcess', 'CreateRemoteThread', 'NtCreateThreadEx']
        registry_apis = ['RegOpenKey', 'RegQueryValue', 'RegSetValue', 'NtOpenKey', 'NtQueryValueKey']
        timing_apis = ['GetTickCount', 'GetTickCount64', 'QueryPerformanceCounter', 'timeGetTime']
        
        sensitive_count = df[df['FunctionName'].isin(sensitive_apis)].shape[0]
        memory_count = df[df['FunctionName'].isin(memory_apis)].shape[0]
        process_count = df[df['FunctionName'].isin(process_apis)].shape[0]
        registry_count = df[df['FunctionName'].isin(registry_apis)].shape[0]
        timing_count = df[df['FunctionName'].isin(timing_apis)].shape[0]
        
        # Análise específica de GetTickCount: detectar loops de timing e anomalias de duração
        timing_df = df[df['FunctionName'].isin(timing_apis)]
        timing_anomaly = 0
        if len(timing_df) > 1:
            # 1. Detectar loops de timing (chamadas muito frequentes)
            timing_intervals = timing_df['StartTime'].astype(float).diff().dropna()
            if timing_intervals.mean() < 500: # Intervalo médio muito curto (< 500 ticks/ms)
                timing_anomaly += 1
            
            # 2. Detectar anomalias na duração das chamadas de timing
            # GetTickCount deve ser extremamente rápida. Se demorar muito, pode indicar instrumentação detectada.
            if timing_df['DurationTicks'].mean() > 5000: # Duração média anormalmente alta
                timing_anomaly += 1
            
            # 3. Detectar padrões de Sleep intercalados com Timing (Anti-Sandbox)
            sleep_apis = ['Sleep', 'SleepEx', 'NtDelayExecution']
            sleep_df = df[df['FunctionName'].isin(sleep_apis)]
            if not sleep_df.empty:
                # Verificar se há chamadas de timing logo antes e depois de um Sleep
                timing_anomaly += 1

        total_calls = df.shape[0]
        sensitive_ratio = sensitive_count / total_calls if total_calls > 0 else 0
        
        # X: [avg_dur, var_dur, sens_ratio, mem_cnt, proc_cnt, reg_cnt, time_cnt, time_anom]
        features = np.array([[avg_duration, var_duration, sensitive_ratio, memory_count, process_count, registry_count, timing_count, timing_anomaly]])
        return np.nan_to_num(features)

    def start_pipe_server(self):
        """
        Inicia o servidor de Named Pipe para receber dados e enviar feedback.
        """
        self.running = True
        pipe_path = f"/tmp/{self.pipe_name}"
        feedback_path = f"/tmp/{self.pipe_name}_feedback"
        
        for p in [pipe_path, feedback_path]:
            if os.path.exists(p): os.remove(p)
            os.mkfifo(p)
        
        def pipe_listener():
            while self.running:
                try:
                    with open(pipe_path, 'r') as pipe:
                        for line in pipe:
                            if line.strip():
                                with self.lock:
                                    self.data_buffer.append(line.strip().split(','))
                except Exception as e:
                    time.sleep(0.1)

        self.listener_thread = threading.Thread(target=pipe_listener, daemon=True)
        self.listener_thread.start()
        print(f"Servidores de Pipe iniciados: {pipe_path} e {feedback_path}")

    def send_feedback(self, command):
        """
        Envia um comando de feedback para o Contradef.
        """
        feedback_path = f"/tmp/{self.pipe_name}_feedback"
        try:
            # Abrir em modo não-bloqueante para evitar travar se ninguém estiver lendo
            fd = os.open(feedback_path, os.O_WRONLY | os.O_NONBLOCK)
            os.write(fd, command.encode())
            os.close(fd)
            print(f"Feedback enviado: {command}")
        except OSError:
            pass # Ninguém lendo o pipe de feedback ainda

    def analyze_realtime(self):
        """
        Analisa os dados acumulados no buffer em tempo real.
        """
        with self.lock:
            if not self.data_buffer:
                return None
            
            # Converter buffer para DataFrame
            df = pd.DataFrame(self.data_buffer, columns=['TID', 'StartTime', 'FunctionName', 'ModuleName', 'DurationTicks'])
            df['DurationTicks'] = pd.to_numeric(df['DurationTicks'])
            
            # Extração de características robustas
            features = self.extract_features(df)
            prediction = self.model.predict(features)[0]
            confidence = self.model.predict_proba(features).max()
            
            sensitive_apis = ['IsDebuggerPresent', 'CheckRemoteDebuggerPresent', 'NtQueryInformationProcess', 'VirtualProtect']
            total_calls = df.shape[0]
            
            return {
                "category": self.categories[prediction],
                "confidence": float(confidence),
                "total_calls": int(total_calls),
                "suspicious_calls": df[df['FunctionName'].isin(sensitive_apis)]['FunctionName'].unique().tolist()
            }

    def stop(self):
        self.running = False
        for p in [f"/tmp/{self.pipe_name}", f"/tmp/{self.pipe_name}_feedback"]:
            if os.path.exists(p): os.remove(p)

if __name__ == "__main__":
    analyzer = AIAnalyzer()
    analyzer.start_pipe_server()
    try:
        while True:
            result = analyzer.analyze_realtime()
            if result:
                print(f"Análise em tempo real: {result['category']} (Confiança: {result['confidence']:.2%})")
            time.sleep(2)
    except KeyboardInterrupt:
        analyzer.stop()

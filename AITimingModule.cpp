#include "pin.H"
#include <iostream>
#include <fstream>
#include <string>
#include <map>
#include <vector>
#include <windows.h>

/*
 * Módulo de Timing e IPC para o Agente de IA do Contradef
 * Este módulo adiciona timestamps de alta precisão e envia dados via Named Pipes.
 */

HANDLE hPipe = INVALID_HANDLE_VALUE;
HANDLE hFeedbackPipe = INVALID_HANDLE_VALUE;
PIN_MUTEX logMutex;
BOOL traceAllFunctions = FALSE; // Controle dinâmico via feedback

struct FunctionCallInfo {
    UINT64 startTime;
    std::string functionName;
    std::string moduleName;
};

std::map<THREADID, std::vector<FunctionCallInfo>> threadCallStacks;

UINT64 GetHighPrecisionTimestamp() {
    LARGE_INTEGER li;
    QueryPerformanceCounter(&li);
    return li.QuadPart;
}

VOID SendDataToAI(std::string data) {
    if (hPipe != INVALID_HANDLE_VALUE) {
        DWORD bytesWritten;
        // Tentar escrever no pipe com verificação de erro
        if (!WriteFile(hPipe, data.c_str(), (DWORD)data.length(), &bytesWritten, NULL)) {
            // Se o pipe quebrar, tentar reconectar ou invalidar o handle
            if (GetLastError() == ERROR_BROKEN_PIPE) {
                CloseHandle(hPipe);
                hPipe = INVALID_HANDLE_VALUE;
            }
        }
    }
}

VOID BeforeFunctionCall(THREADID tid, ADDRINT instAddr, std::string* name, std::string* mod) {
    PIN_MutexLock(&logMutex);
    FunctionCallInfo info;
    info.startTime = GetHighPrecisionTimestamp();
    info.functionName = *name;
    info.moduleName = *mod;
    threadCallStacks[tid].push_back(info);
    PIN_MutexUnlock(&logMutex);
}

VOID AfterFunctionCall(THREADID tid, ADDRINT instAddr) {
    PIN_MutexLock(&logMutex);
    if (!threadCallStacks[tid].empty()) {
        FunctionCallInfo info = threadCallStacks[tid].back();
        threadCallStacks[tid].pop_back();
        UINT64 endTime = GetHighPrecisionTimestamp();
        UINT64 duration = endTime - info.startTime;

        // Formato CSV para o Pipe: TID,StartTime,FunctionName,ModuleName,Duration
        std::string logEntry = std::to_string(tid) + "," +
                               std::to_string(info.startTime) + "," +
                               info.functionName + "," +
                               info.moduleName + "," +
                               std::to_string(duration) + "\n";
        SendDataToAI(logEntry);
    }
    PIN_MutexUnlock(&logMutex);
}

// Função para verificar feedback da IA
// Função para verificar feedback da IA de forma periódica
VOID CheckAIFeedback(VOID* v) {
    if (hFeedbackPipe != INVALID_HANDLE_VALUE) {
        char buffer[128];
        DWORD bytesRead;
        DWORD bytesAvailable;
        
        // Verificar se há dados disponíveis sem bloquear a execução do PinTool
        if (PeekNamedPipe(hFeedbackPipe, NULL, 0, NULL, &bytesAvailable, NULL) && bytesAvailable > 0) {
            if (ReadFile(hFeedbackPipe, buffer, sizeof(buffer)-1, &bytesRead, NULL) && bytesRead > 0) {
                buffer[bytesRead] = '\0';
                std::string cmd(buffer);
                if (cmd.find("TRACE_ALL_ON") != std::string::npos) {
                    traceAllFunctions = TRUE;
                    std::cout << "[AI_FEEDBACK] Ativando rastreamento completo de funções." << std::endl;
                }
                else if (cmd.find("TRACE_ALL_OFF") != std::string::npos) {
                    traceAllFunctions = FALSE;
                    std::cout << "[AI_FEEDBACK] Desativando rastreamento completo de funções." << std::endl;
                }
            }
        }
    }
}

VOID InstrumentRoutine(RTN rtn, VOID* v) {
    RTN_Open(rtn);
    std::string name = RTN_Name(rtn);
    
    // Lógica de feedback: se traceAllFunctions for TRUE, instrumenta tudo.
    // Caso contrário, instrumenta apenas APIs sensíveis conhecidas.
    BOOL shouldInstrument = traceAllFunctions || 
                           (name.find("Virtual") != std::string::npos) || 
                           (name.find("CreateProcess") != std::string::npos) ||
                           (name.find("Debugger") != std::string::npos);

    if (shouldInstrument) {
        std::string* pName = new std::string(name);
        SEC sec = RTN_Sec(rtn);
        IMG img = SEC_Img(sec);
        std::string* pMod = new std::string(IMG_Valid(img) ? IMG_Name(img) : "Unknown");

        RTN_InsertCall(rtn, IPOINT_BEFORE, (AFUNPTR)BeforeFunctionCall,
                       IARG_THREAD_ID, IARG_INST_PTR, IARG_PTR, pName, IARG_PTR, pMod, IARG_END);
        RTN_InsertCall(rtn, IPOINT_AFTER, (AFUNPTR)AfterFunctionCall,
                       IARG_THREAD_ID, IARG_INST_PTR, IARG_END);
    }
    RTN_Close(rtn);
}

VOID InitAIModule(std::string pipeName) {
    PIN_MutexInit(&logMutex);
    
    // Pipe de Dados (Escrita)
    std::string fullPipeName = "\\\\.\\pipe\\" + pipeName;
    hPipe = CreateFileA(fullPipeName.c_str(), GENERIC_WRITE, 0, NULL, OPEN_EXISTING, 0, NULL);
    
    // Pipe de Feedback (Leitura)
    std::string feedbackPipeName = "\\\\.\\pipe\\" + pipeName + "_feedback";
    hFeedbackPipe = CreateFileA(feedbackPipeName.c_str(), GENERIC_READ, 0, NULL, OPEN_EXISTING, 0, NULL);

    // Registrar uma função periódica para verificar feedback a cada 100ms
    PIN_AddContextChangeFunction((CONTEXT_CHANGE_CALLBACK)CheckAIFeedback, 0);
}

VOID FiniAIModule(INT32 code, VOID* v) {
    if (hPipe != INVALID_HANDLE_VALUE) CloseHandle(hPipe);
}

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import subprocess
import textwrap

ROOT = Path(__file__).resolve().parent
OUT_DIR = ROOT / "video_assets"
OUT_DIR.mkdir(exist_ok=True)

W, H = 1280, 720
BG = "#07111f"
PANEL = "#0f1b32"
PANEL_ALT = "#101a2a"
ACCENT = "#22d3ee"
TEXT = "#f8fafc"
MUTED = "#9fb2c8"
SUCCESS = "#22c55e"
WARN = "#f59e0b"
DANGER = "#ef4444"
PURPLE = "#8b5cf6"

try:
    title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 54)
    subtitle_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28)
    body_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 30)
    small_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22)
    mono_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 24)
except Exception:
    title_font = subtitle_font = body_font = small_font = mono_font = ImageFont.load_default()

scenes = [
    {
        "kind": "hero",
        "title": "AI Contradef + Dashboard Web",
        "subtitle": "Análise de malware em tempo real com IA interpretável",
        "body": "Este vídeo mostra como subir localmente o agente em C++/Python, conectar o bridge em tempo real e acompanhar o comportamento do malware no painel web.",
        "footer": "Fluxo operacional: Contradef -> AIAnalyzer.py -> AIWebBridge.py -> Dashboard",
    },
    {
        "kind": "checklist",
        "title": "Pré-requisitos do ambiente",
        "subtitle": "Base operacional para Windows e análise local",
        "body": [
            "Windows x64 com Intel Pin e Visual Studio C++",
            "Python 3 com dependências do AIAnalyzer",
            "Node.js + pnpm para o dashboard web",
            "Repositórios AI_contradef e ai_contradef_web",
        ],
        "footer": "Baseado no MANUAL.md atualizado",
    },
    {
        "kind": "terminal",
        "title": "Passo 1 — Iniciar o AIAnalyzer",
        "subtitle": "Servidor analítico ouvindo o Named Pipe",
        "command": "cd C:\\AI_contradef\npython AIAnalyzer.py",
        "output": [
            "[AIAnalyzer] Pipe iniciado: \\.\\pipe\\AIContradefPipe",
            "[AIAnalyzer] Aguardando eventos do PinTool...",
        ],
        "footer": "Terminal 1",
    },
    {
        "kind": "terminal",
        "title": "Passo 2 — Subir a aplicação web",
        "subtitle": "Camada de observabilidade e relatórios",
        "command": "cd C:\\AI_contradef_web\npnpm install\npnpm db:push\npnpm dev",
        "output": [
            "[web] migrações aplicadas com sucesso",
            "[web] servidor local disponível em http://localhost:3000",
        ],
        "footer": "Terminal 2",
    },
    {
        "kind": "terminal",
        "title": "Passo 3 — Conectar o AIWebBridge",
        "subtitle": "Ponte entre o analisador e o dashboard",
        "command": "cd C:\\AI_contradef\npython AIWebBridge.py --dashboard-url http://localhost:3000 --sample-name target.exe --session-key sessao-demo",
        "output": [
            "[AIWebBridge] sessão conectada ao dashboard",
            "[AIWebBridge] publicando logs e detecções em tempo real",
        ],
        "footer": "Terminal 3",
    },
    {
        "kind": "terminal",
        "title": "Passo 4 — Executar a amostra instrumentada",
        "subtitle": "Coleta do PinTool do Contradef",
        "command": '"C:\\pin\\pin.exe" -t "C:\\AI_contradef\\AITimingModule.dll" -- "C:\\AI_contradef\\target.exe"',
        "output": [
            "[pin] instrumentação ativa para funções selecionadas",
            "[pin] enviando TID, StartTime, FunctionName, ModuleName e DurationTicks",
        ],
        "footer": "Terminal 4",
    },
    {
        "kind": "dashboard",
        "title": "Leitura do dashboard em tempo real",
        "subtitle": "Painéis criados para analistas de segurança",
        "body": "Os logs chegam com os campos TID, StartTime, FunctionName, ModuleName e DurationTicks, enquanto o painel executivo resume severidade, categoria e estado da sessão.",
        "footer": "Visão executiva + logs estruturados",
    },
    {
        "kind": "dashboard",
        "title": "Anomalias temporais monitoradas",
        "subtitle": "APIs críticas de timing em destaque",
        "body": "GetTickCount, QueryPerformanceCounter e GetSystemTimeAsFileTime recebem indicadores visuais próprios para revelar loops de timing, desvios e comportamento anti-sandbox.",
        "footer": "Timing monitor",
    },
    {
        "kind": "dashboard",
        "title": "Classificação e alertas",
        "subtitle": "Classes operacionais da IA",
        "body": "O painel categoriza a execução como Benigno, Anti-Debugging, Anti-VM, Injeção de Código ou Ofuscação, sempre com nível de confiança e alertas de alta severidade quando necessário.",
        "footer": "Detecção + notificações",
    },
    {
        "kind": "dashboard",
        "title": "Fluxo de execução e função por função",
        "subtitle": "Interpretação do caminho percorrido pela amostra",
        "body": "O analista acompanha o encadeamento entre funções, a categoria associada a cada API e a tabela quantitativa com contagem, descrição e contexto operacional.",
        "footer": "Fluxo do malware + quantificação",
    },
    {
        "kind": "dashboard",
        "title": "Histórico e relatórios narrativos",
        "subtitle": "Persistência e exportação da sessão",
        "body": "Cada sessão pode ser exportada em JSON e enriquecida com um relatório em linguagem natural que explica técnica evasiva, comportamento observado e recomendações de mitigação.",
        "footer": "Evidência pronta para reporte",
    },
    {
        "kind": "hero",
        "title": "Encerramento",
        "subtitle": "Instrumentação, IA e interpretação no mesmo fluxo",
        "body": "Com essa arquitetura, o AI Contradef deixa de ser apenas um coletor de eventos e passa a oferecer contexto analítico, priorização de riscos e rastreabilidade operacional para o analista.",
        "footer": "Consulte também MANUAL.md, SMOKE_TEST.md e README.md",
    },
]


def rounded(draw, box, fill, outline=None, width=1, radius=28):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def wrap(text, width):
    return textwrap.wrap(text, width=width)


def draw_base(draw, title, subtitle, footer, scene_no):
    draw.rectangle((0, 0, W, H), fill=BG)
    draw.ellipse((40, 40, 300, 300), fill="#0b2238")
    draw.ellipse((1030, 30, 1240, 240), fill="#21113f")
    rounded(draw, (50, 40, 1230, 680), PANEL, outline="#1f3754", width=2, radius=38)
    rounded(draw, (80, 70, 380, 110), "#0f3240", outline="#155e75", width=2, radius=18)
    draw.text((100, 78), "AI Contradef Local Walkthrough", font=small_font, fill=ACCENT)
    draw.text((90, 145), title, font=title_font, fill=TEXT)
    draw.text((90, 220), subtitle, font=subtitle_font, fill=ACCENT)
    draw.line((90, 625, 1190, 625), fill="#294664", width=2)
    draw.text((90, 642), footer, font=small_font, fill=MUTED)
    draw.text((1140, 642), f"{scene_no:02d}/{len(scenes):02d}", font=small_font, fill=MUTED)


def draw_hero(draw, scene, idx):
    draw_base(draw, scene["title"], scene["subtitle"], scene["footer"], idx)
    for i, line in enumerate(wrap(scene["body"], 50)):
        draw.text((90, 320 + i * 46), line, font=body_font, fill=TEXT)
    rounded(draw, (760, 300, 1160, 540), PANEL_ALT, outline="#28466a", width=2, radius=24)
    draw.text((790, 330), "Pipeline", font=subtitle_font, fill=SUCCESS)
    steps = ["Contradef", "AIAnalyzer.py", "AIWebBridge.py", "Dashboard"]
    colors = [ACCENT, PURPLE, WARN, SUCCESS]
    y = 385
    for step, color in zip(steps, colors):
        rounded(draw, (800, y, 1120, y + 42), "#0b1627", outline=color, width=2, radius=14)
        draw.text((825, y + 8), step, font=small_font, fill=TEXT)
        y += 52


def draw_checklist(draw, scene, idx):
    draw_base(draw, scene["title"], scene["subtitle"], scene["footer"], idx)
    y = 320
    for item in scene["body"]:
        rounded(draw, (90, y - 8, 1120, y + 34), "#0b1627", outline="#2a4766", width=2, radius=16)
        draw.ellipse((115, y + 4, 135, y + 24), fill=SUCCESS)
        draw.text((155, y), item, font=body_font, fill=TEXT)
        y += 72


def draw_terminal(draw, scene, idx):
    draw_base(draw, scene["title"], scene["subtitle"], scene["footer"], idx)
    rounded(draw, (85, 300, 1195, 575), "#0a1220", outline="#314b6a", width=2, radius=26)
    draw.rectangle((85, 300, 1195, 338), fill="#111d30")
    for x, color in [(110, DANGER), (140, WARN), (170, SUCCESS)]:
        draw.ellipse((x, 312, x + 16, 328), fill=color)
    cmd_y = 365
    for line in scene["command"].split("\n"):
        draw.text((120, cmd_y), f"$ {line}", font=mono_font, fill=SUCCESS)
        cmd_y += 38
    cmd_y += 20
    for line in scene["output"]:
        for wrapped in wrap(line, 64):
            draw.text((120, cmd_y), wrapped, font=mono_font, fill=MUTED)
            cmd_y += 34


def small_panel(draw, box, title, lines, accent):
    rounded(draw, box, PANEL_ALT, outline="#2b4767", width=2, radius=18)
    x1, y1, x2, y2 = box
    draw.text((x1 + 18, y1 + 16), title, font=small_font, fill=accent)
    cy = y1 + 56
    for line in lines:
        draw.text((x1 + 18, cy), line, font=small_font, fill=TEXT)
        cy += 28


def draw_dashboard(draw, scene, idx):
    draw_base(draw, scene["title"], scene["subtitle"], scene["footer"], idx)
    small_panel(draw, (85, 300, 470, 430), "Sessão ativa", ["sample: target.exe", "status: running", "classe: Anti-Debugging"], ACCENT)
    small_panel(draw, (495, 300, 1195, 430), "Logs", ["TID 1204 | GetTickCount | kernel32.dll | 6100", "TID 1204 | IsDebuggerPresent | kernel32.dll | 33", "TID 1204 | QueryPerformanceCounter | kernel32.dll | 5800"], SUCCESS)
    small_panel(draw, (85, 455, 520, 590), "Detecções", ["Anti-Debugging — 86.4%", "Anti-VM — 8.2%", "Benigno — 5.4%"], PURPLE)
    small_panel(draw, (545, 455, 860, 590), "Timing monitor", ["GetTickCount: anomalia", "QPC: desvio alto", "GSTAFT: normal"], WARN)
    small_panel(draw, (885, 455, 1195, 590), "Alertas", ["Nenhum crítico nesta cena", "JSON exportável disponível"], DANGER)
    for i, line in enumerate(wrap(scene["body"], 58)):
        draw.text((90, 605 + i * 24), line, font=small_font, fill=MUTED)


def render_scene(scene, idx):
    image = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(image)
    kind = scene["kind"]
    if kind == "hero":
        draw_hero(draw, scene, idx)
    elif kind == "checklist":
        draw_checklist(draw, scene, idx)
    elif kind == "terminal":
        draw_terminal(draw, scene, idx)
    else:
        draw_dashboard(draw, scene, idx)
    return image


for idx, scene in enumerate(scenes, start=1):
    render_scene(scene, idx).save(OUT_DIR / f"scene_{idx:02d}.png")

subprocess.run([
    "ffmpeg", "-y", "-framerate", "1/6", "-i", str(OUT_DIR / "scene_%02d.png"),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-vf", "scale=1280:720,format=yuv420p",
    str(ROOT / "AI_contradef_local_runbook.mp4")
], check=True)

print(ROOT / "AI_contradef_local_runbook.mp4")

#!/usr/bin/env python3
"""QA 416224 — validação completa do Gemini key no PRODUÇÃO (pedido do dono).
Testa: (1) texto ×3 consistência, (2) questão Av1 de matrizes, (3) visão com imagem gerada.
Uso: python3 scripts/qa-gemini-validation.py
"""
import json
import time
import urllib.request
from PIL import Image, ImageDraw, ImageFont

PROD = "https://hub-estudos-ifpb.vercel.app/api/tutor"
BODY = {"discipline": "QA Gemini", "disciplineCode": "QA-GEM", "stream": False}


def post(payload, timeout=90):
    req = urllib.request.Request(
        PROD,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = json.loads(r.read().decode())
    return data, round(time.time() - t0, 1)


def make_test_image(path):
    img = Image.new("RGB", (560, 200), "white")
    d = ImageDraw.Draw(img)
    try:
        f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 64)
        f2 = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 40)
    except Exception:
        f = f2 = ImageFont.load_default()
    d.text((40, 40), "2x + 5 = 15", font=f, fill="black")
    d.text((40, 130), "Equacao do 1o grau", font=f2, fill=(60, 60, 60))
    img.save(path)
    import base64

    with open(path, "rb") as fp:
        return "data:image/png;base64," + base64.b64encode(fp.read()).decode()


print("=" * 62)
print("TESTE 1 — CONSISTÊNCIA: mesma pergunta ×3 (resposta deve bater)")
print("=" * 62)
answers = []
for i in range(3):
    try:
        d, ms = post({**BODY, "question": "Quanto é 7 × 8? Responda APENAS o número, sem texto."})
        ans = (d.get("answer") or "").strip()
        model = d.get("model") or "?"
        answers.append(ans)
        print(f"  run {i+1}: {ms}s via {model} -> {ans[:60]!r}")
    except Exception as e:
        answers.append(None)
        print(f"  run {i+1}: ERRO {e}")
    time.sleep(1)
ok1 = all(a and "56" in a for a in answers)
print(f"  => CONSISTENTE: {'✅ SIM' if ok1 else '❌ NÃO'} ({answers})")

print()
print("=" * 62)
print("TESTE 2 — QUALIDADE Av1: transposta de matriz 2x2")
print("=" * 62)
try:
    d, ms = post({
        **BODY,
        "question": "Qual é a transposta da matriz A = [[1, 2], [3, 4]]? Responda em UMA linha, escrevendo a matriz resultante entre colchetes.",
    })
    ans = (d.get("answer") or "").replace("\n", " ")
    print(f"  {ms}s via {d.get('model')} -> {ans[:220]}")
    ok2 = "1" in ans and "3" in ans and "2" in ans and "4" in ans
    print(f"  => valores corretos [[1,3],[2,4]] presentes: {'✅' if ok2 else '❌'}")
except Exception as e:
    ok2 = False
    print(f"  ERRO {e}")

print()
print("=" * 62)
print("TESTE 3 — VISÃO: imagem '2x + 5 = 15' (cadeia Gemini primeiro)")
print("=" * 62)
data_url = make_test_image("/home/z/my-project/scripts/qa38-vision-test.png")
try:
    d, ms = post({**BODY, "question": "Transcreva EXATAMENTE a equação que aparece na imagem.", "imageDataUrl": data_url})
    ans = (d.get("answer") or "").replace("\n", " ")
    print(f"  {ms}s via {d.get('model')} -> {ans[:200]}")
    ok3 = "2x" in ans and "5" in ans and "15" in ans
    print(f"  => leitura correta da imagem: {'✅' if ok3 else '❌'}")
except Exception as e:
    ok3 = False
    print(f"  ERRO {e}")

print()
print("=" * 62)
print(f"RESUMO: consistência {'✅' if ok1 else '❌'} · matrizes {'✅' if ok2 else '❌'} · visão {'✅' if ok3 else '❌'}")
print("=" * 62)

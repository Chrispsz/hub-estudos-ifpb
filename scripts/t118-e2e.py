#!/usr/bin/env python3
# Task 118 — O PROGRESSO SE REGISTRA SOZINHO (QA E2E em playwright próprio).
# Por quê um browser próprio: o agent-browser é ÚNICO e compartilhado entre
# rodadas paralelas — duas sessões navegam no mesmo tab e as asserções de uma
# sessão leem a página da outra (visto ao vivo nesta rodada: um 'Estudar'
# clicado pela 118 foi desfeito por um hash da sessão vizinha 2s depois). O
# playwright aqui sobe um chromium ISOLADO (storage próprio, zero disputa).
#
# Verifica: [A] perfil limpo = ZERO 'atrasada' no painel + Av1 sem barra +
# selo 'sem registro' + KPI 'Disciplinas ativas' 0; [A2] checklist limpo =
# dica didática + ponteiro '0/2 materiais'; [B] atividade semeada = Av1
# 'em estudo' amber + barra 50% + KPI 1 + LM 'sem registro' + prévia lendo a
# mesma fonte; [C] checklist = badge 'em estudo' + evidência '1/2 materiais'
# '1/7 questões' + linha 'com atividade sua · última hoje'; [D] abrir
# material escreve disciplineProgress.lastStudiedAt; [E] mobile 390 sem
# overflow; [F] higiene total + console 0.
import json
import re
import sys
import time
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
STORE = "hub-estudos-ifpb:v2"

results = {"ok": 0, "fail": 0, "errors": []}
console_errors: list[str] = []


def ok(msg: str) -> None:
    results["ok"] += 1
    print(f"  [OK] {msg}")


def bad(msg: str) -> None:
    results["fail"] += 1
    results["errors"].append(msg)
    print(f"  [FAIL] {msg}")


def check(cond: bool, ok_msg: str, fail_msg: str) -> None:
    ok(cond and ok_msg) if cond else bad(fail_msg)


def has_text(page, needle: str) -> bool:
    return page.evaluate(
        "(t) => document.body.textContent.replace(/\\s+/g,' ').indexOf(t) >= 0", needle
    )


def wipe(page) -> None:
    page.evaluate("k => localStorage.removeItem(k)", STORE)
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(2500)


def kpi_val(page, label: str) -> str:
    return page.evaluate(
        """(label) => {
          const cards = document.querySelectorAll('[data-slot="card"]');
          for (const c of cards) {
            const m = (c.textContent || '').match(new RegExp('(\\\\d+)\\\\s*' + label));
            if (m) return m[1];
          }
          return 'X';
        }""",
        label,
    )


def row_badge(page, code_eval: str) -> str:
    return page.evaluate(
        """(sel) => {
          const c = document.querySelector('[data-eval-row="' + sel + '"]');
          if (!c) return 'NOCARD';
          for (const b of c.querySelectorAll('[data-slot="badge"]')) {
            const tx = (b.textContent || '').trim();
            if (['em dia', 'em estudo', 'sem registro'].includes(tx))
              return tx + '|' + (b.className || '');
          }
          return 'NOBADGE';
        }""",
        code_eval,
    )


def row_bar(page, code_eval: str) -> str:
    return page.evaluate(
        """(sel) => {
          const c = document.querySelector('[data-eval-row="' + sel + '"]');
          if (!c) return 'NOCARD';
          const b = c.querySelector('[role="progressbar"]');
          return b ? 'BAR' + b.getAttribute('aria-valuenow') : 'NOBAR';
        }""",
        code_eval,
    )


def previa_badge(page, code: str) -> str:
    return page.evaluate(
        """(code) => {
          const r = document.querySelector('[data-activity-row="' + code + '"]');
          if (!r) return 'NOROW';
          const bs = r.querySelectorAll('[data-slot="badge"]');
          return bs.length ? bs[bs.length - 1].textContent.trim() : 'NOBADGE';
        }""",
        code,
    )


def seed_activity(page) -> None:
    page.evaluate(
        """(store) => {
          const p = JSON.parse(localStorage.getItem(store) || '{}');
          const now = new Date().toISOString();
          p.materialProgress = p.materialProgress || {};
          p.materialProgress['mat-00-matrizes'] = { lastAccessedAt: now };
          p.exerciseProgress = p.exerciseProgress || {};
          p.exerciseProgress['mat-001'] = {
            tried: true, solved: false, neededHelp: false, lastPracticedAt: now,
          };
          localStorage.setItem(store, JSON.stringify(p));
        }""",
        STORE,
    )


def go_estudar(page) -> None:
    page.click("text=Estudar", position={"x": 4, "y": 4}, timeout=8000)
    page.wait_for_timeout(1800)


def select_matematica(page) -> None:
    page.locator("#study-discipline").click()
    page.wait_for_timeout(900)
    page.locator('[role="option"]', has_text="Matemática Aplicada").click()
    page.wait_for_timeout(1800)


def go_dash(page) -> None:
    page.click("text=Visão Geral", timeout=8000)
    page.wait_for_timeout(1800)


def main() -> int:
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.on(
            "console",
            lambda m: console_errors.append(m.text) if m.type == "error" else None,
        )
        page.on("pageerror", lambda e: console_errors.append(str(e)))

        print("=== [A] PERFIL LIMPO: a palavra 'atrasada' saiu do painel ===")
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(2500)
        wipe(page)

        check(
            not has_text(page, "atrasada"),
            "ZERO 'atrasada' no painel inteiro (a acusação sem registro morreu)",
            "ainda existe 'atrasada' no painel",
        )
        check(
            has_text(page, "sem registro"),
            "selo honesto 'sem registro' presente",
            "selo 'sem registro' ausente",
        )
        check(
            row_bar(page, "TEC.1984-Av1") == "BAR0",
            "Av1 barra honesta em 0% (conteúdo dado existe, atividade zero — aponta o caminho sem acusar)",
            f"Av1 barra errada: {row_bar(page, 'TEC.1984-Av1')}",
        )
        check(
            row_badge(page, "TEC.1984-Av1").startswith("sem registro"),
            "selo da Av1 = 'sem registro'",
            f"selo da Av1 errado: {row_badge(page, 'TEC.1984-Av1')}",
        )
        check(
            kpi_val(page, "Disciplinas ativas") == "0",
            "KPI 'Disciplinas ativas' = 0 no perfil limpo",
            f"KPI Disciplinas ativas errado: {kpi_val(page, 'Disciplinas ativas')}",
        )

        print("=== [A2] CHECKLIST LIMPO: a dica didática responde 'em que momento marco' ===")
        go_estudar(page)
        select_matematica(page)
        check(
            has_text(page, "Marque o tópico quando conseguir resolver sem olhar o material"),
            "dica didática visível: marque quando resolver sem olhar; o resto o Hub registra sozinho",
            "dica didática ausente",
        )
        check(
            page.evaluate("() => document.body.textContent.split('em estudo').length - 1") == 0,
            "nenhum badge 'em estudo' sem atividade (nada inventado)",
            "badge 'em estudo' sem evidência",
        )
        check(
            has_text(page, "0/2 materiais"),
            "ponteiro didático '0/2 materiais' nas unidades dadas (o que abrir)",
            "ponteiro de materiais ausente",
        )

        print("=== [B] ATIVIDADE SEMEADA: o painel reage ao fluxo real ===")
        go_dash(page)
        seed_activity(page)
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(2500)

        bb = row_badge(page, "TEC.1984-Av1")
        check(
            bb.startswith("em estudo"),
            "Av1 flipou para 'em estudo' (material aberto + questão tentada contam)",
            f"Av1 não reagiu à atividade: {bb}",
        )
        check(
            "amber-300/70" in bb,
            "selo 'em estudo' na família da espera (amber, sem pulso — não é prazo)",
            f"selo fora da família amber: {bb}",
        )
        check(
            row_bar(page, "TEC.1984-Av1") == "BAR50",
            "barra da Av1 = 50% (1 de 2 unidades dadas tocada — conteúdo não dado não pune)",
            f"barra da Av1 errada: {row_bar(page, 'TEC.1984-Av1')}",
        )
        check(
            kpi_val(page, "Disciplinas ativas") == "1",
            "KPI 'Disciplinas ativas' = 1 (o estudo de hoje apareceu)",
            f"KPI não contou: {kpi_val(page, 'Disciplinas ativas')}",
        )
        bl = row_badge(page, "TEC.1632-Projeto 1ª etapa")
        check(
            bl.startswith("sem registro"),
            "LM (A2) continua 'sem registro' (atividade não vaza entre disciplinas)",
            f"selo da LM errado: {bl}",
        )
        check(
            not has_text(page, "atrasada"),
            "mesmo com 0 atividade em LM/Alg, NADA diz 'atrasada'",
            "'atrasada' voltou",
        )
        pb = previa_badge(page, "TEC.1984")
        check(
            pb.startswith("em estudo"),
            "prévia do semestre lê a MESMA fonte (Mat 'em estudo')",
            f"prévia não acompanhou: {pb}",
        )
        page.screenshot(path="scripts/qa118-atividade-desktop.png", full_page=False)
        ok("screenshot desktop (qa118-atividade-desktop.png)")

        print("=== [C] CHECKLIST VIVO: a evidência da unidade 1 ===")
        go_estudar(page)
        select_matematica(page)
        count_em_estudo = page.evaluate(
            "() => document.body.textContent.split('em estudo').length - 1"
        )
        check(
            count_em_estudo == 1,
            "badge 'em estudo' só na unidade com atividade (1 de 4)",
            f"contagem de badges 'em estudo' errada: {count_em_estudo}",
        )
        check(
            has_text(page, "1/2 materiais"),
            "evidência '1/2 materiais' na unidade 1",
            "evidência de materiais errada",
        )
        check(
            has_text(page, "1/7 questões"),
            "evidência '1/7 questões' na unidade 1",
            "evidência de questões errada",
        )
        check(
            has_text(page, "unidade com atividade sua · última hoje"),
            "linha de resumo: '1 unidade com atividade sua · última hoje'",
            "linha de resumo da atividade ausente",
        )
        check(
            not has_text(page, "Marque o tópico quando conseguir"),
            "dica didática dá lugar à linha de atividade (o estado fala)",
            "dica e atividade se sobrepondo",
        )

        print("=== [D] O FLUXO REAL REGISTRA: abrir material toca lastStudiedAt ===")
        pre = page.evaluate(
            """() => {
              const p = JSON.parse(localStorage.getItem('%s') || '{}');
              return (p.disciplineProgress && p.disciplineProgress['TEC.1984']
                      && p.disciplineProgress['TEC.1984'].lastStudiedAt)
                ? p.disciplineProgress['TEC.1984'].lastStudiedAt : 'UNSET';
            }"""
            % STORE
        )
        check(
            pre == "UNSET",
            "pré-condição: lastStudiedAt de Matemática ainda unset (o seed só tocou materialProgress)",
            f"pré-condição falhou: {pre}",
        )
        page.click("text=Biblioteca", timeout=8000)
        page.wait_for_timeout(1800)
        page.locator("button", has_text="Matrizes — teoria da Aula 00").first.click()
        page.wait_for_timeout(2000)
        post = page.evaluate(
            """() => {
              const p = JSON.parse(localStorage.getItem('%s') || '{}');
              return (p.disciplineProgress && p.disciplineProgress['TEC.1984']
                      && p.disciplineProgress['TEC.1984'].lastStudiedAt)
                ? p.disciplineProgress['TEC.1984'].lastStudiedAt : 'UNSET';
            }"""
            % STORE
        )
        check(
            post != "UNSET",
            "abrir o material escreveu disciplineProgress.lastStudiedAt (o fluxo real registra sozinho)",
            "markAccessed NÃO tocou lastStudiedAt",
        )
        today = page.evaluate("() => new Date().toISOString().slice(0, 10)")
        check(
            post[:10] == today,
            f"o registro é de hoje ({today})",
            f"registro com data estranha: {post}",
        )
        page.keyboard.press("Escape")
        page.wait_for_timeout(1200)
        page.keyboard.press("Escape")
        page.wait_for_timeout(800)

        print("=== [E] MOBILE 390: painel honesto sem overflow ===")
        go_dash(page)
        page.set_viewport_size({"width": 390, "height": 844})
        page.wait_for_timeout(1500)
        iw = page.evaluate("() => document.documentElement.scrollWidth")
        sw = page.evaluate("() => window.innerWidth")
        check(
            iw <= sw,
            f"mobile 390 sem overflow (iw={iw} sw={sw})",
            f"overflow no mobile (iw={iw} sw={sw})",
        )
        page.locator("h3", has_text="Próximas avaliações").first.scroll_into_view_if_needed()
        page.wait_for_timeout(600)
        page.screenshot(path="scripts/qa118-atividade-mobile390.png", full_page=False)
        ok("screenshot mobile (qa118-atividade-mobile390.png)")

        print("=== [F] HIGIENE TOTAL + CONSOLE ===")
        wipe(page)
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(2000)
        res = page.evaluate(
            """(store) => {
              const p = JSON.parse(localStorage.getItem(store) || '{}');
              const n = (x) => Object.keys(x || {}).length;
              return 'runs=' + n(p.simuladoRuns) + ' cards=' + n(p.flashcards)
                + ' poke=' + (p.__poke || 0) + ' realGrades=' + n(p.realGrades)
                + ' mat=' + n(p.materialProgress) + ' ex=' + n(p.exerciseProgress)
                + ' top=' + n(p.topicProgress) + ' disc=' + n(p.disciplineProgress);
            }""",
            STORE,
        )
        print(f"  {res}")
        check(
            res == "runs=0 cards=0 poke=0 realGrades=0 mat=0 ex=0 top=0 disc=0",
            "storage 100% limpo (o seed da 118 também foi embora)",
            f"resíduo no storage: {res}",
        )
        check(
            has_text(page, "Faltam"),
            "data real de volta (hero do relógio vivo)",
            "hero sem 'Faltam'",
        )
        real_errors = [e for e in console_errors if "Download the React DevTools" not in e]
        check(
            len(real_errors) == 0,
            "console: 0 erros",
            f"console com {len(real_errors)} erros: {real_errors[:3]}",
        )

        browser.close()

    print()
    if results["fail"] == 0:
        print(f"ALL GREEN — t118 ({results['ok']} asserções): o progresso se registra sozinho")
        return 0
    print(f"FAIL — {results['fail']} falha(s) de {results['ok'] + results['fail']}")
    return 1


if __name__ == "__main__":
    sys.exit(main())

"""Gera public/pdfs/alg-questoes-semana3.pdf — recriação fiel do PDF original
(1 página, 8 questões numeradas) a partir da transcrição do dono."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.platypus import SimpleDocTemplate, Paragraph

QUESTOES = [
    "Escreva um programa que leia um número inteiro e determine o seu valor absoluto. O valor absoluto deve ser calculado sem o uso de qualquer função oferecida pela linguagem.",
    "Escreva um programa que leia o número de gols marcados pelo time da casa e o número de gols marcado pelo time visitante e verifique se o jogo foi vencido pelo time da casa, pelo time visitante ou se terminou empatado.",
    "Escreva um programa que leia a idade de uma pessoa e verifique se ela é criança (0-12 anos), adolescente (13-17 anos), adulta (18-59) ou idosa (acima de 60 anos).",
    "Escreva um programa que leia o valor de um ano e verifique se ele é ou não bissexto. Um ano é bissexto se ele for divisível por quatrocentos ou se se ele for divisível por 4 mas não for divisível por 100.",
    "Escreva um programa que leia as coordenadas x e y de um ponto e verifique a quantidade de quadrantes a que este ponto pertence.",
    "Escreva um programa que leia três números inteiros distintos e identifique o maior número informado.",
    "Escreva um programa que leia os valores dos três ângulos internos de um triângulo e verifique se o mesmo é um triângulo retângulo.",
    "Alfredo tem um carro flex e sempre fica na dúvida se é melhor abastecê-lo com álcool ou gasolina. Um dia um de seus amigos o ensinou a seguinte dica: “Pegue o valor do preço da gasolina e multiplique por 0,7. Se o valor for menor ou igual ao valor do preço do álcool, abasteça com gasolina. Caso contrário, abasteça com álcool.” Com base nestas informações, escreva um programa que leia o preço do litro da gasolina e do álcool e verifique se é melhor abastecer com álcool ou com gasolina.",
]

doc = SimpleDocTemplate(
    "/home/z/my-project/public/pdfs/alg-questoes-semana3.pdf",
    pagesize=A4, leftMargin=25*mm, rightMargin=25*mm,
    topMargin=22*mm, bottomMargin=22*mm, title="Questões Semana 3 — Algoritmos",
)
q_style = ParagraphStyle("q", fontName="Helvetica", fontSize=11, leading=16.5, alignment=TA_JUSTIFY, spaceAfter=14)

story = [Paragraph(f"<b>{i}.</b>&nbsp;&nbsp;{q}", q_style) for i, q in enumerate(QUESTOES, 1)]

doc.build(story)
print("PDF gerado com sucesso")

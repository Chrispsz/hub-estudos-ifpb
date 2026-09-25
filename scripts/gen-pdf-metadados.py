"""Gera public/pdfs/lm-html-07-metadados.pdf — recriação fiel do slide deck
"Linguagens de Marcação - 07 - Metadados.pdf" (19 slides, Google Slides 16:9)
a partir da transcrição completa enviada pelo dono (o binário original não
chegou ao servidor). Estilo: capa + páginas de conteúdo com título "Metadados",
rodapé da disciplina e número de página."""
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.pdfgen import canvas as pdfcanvas

W, H = landscape(A4)
DARK = HexColor('#202124')
GRAY = HexColor('#5f6368')
RED = HexColor('#8c1d13')  # barra superior IFPB

# (titulo, [bullets], nota_visual) — nota_visual descreve imagem/exemplo do slide
SLIDES = [
    ("Metadados", [
        "Metadados são <b>dados sobre dados</b>. Informações sobre a própria "
        "informação. Metadados são estruturas de informações que descrevem "
        "características de uma fonte de informação.",
    ], None),
    ("Metadados", [
        "Como vimos anteriormente, a tag <b>HEAD</b> contém informações que não "
        "são transpostas visivelmente para o usuário/leitor do documento",
        "Ao contrário do conteúdo do elemento <b>&lt;body&gt;</b>, que são exibidos na "
        "página quando carregados no navegador",
    ], None),
    ("Metadados", [
        "O trabalho do <b>HEAD</b> é conter metadados sobre o documento",
        "Nós já vimos o elemento <b>&lt;title&gt;</b> em ação — ele pode ser usado para "
        "adicionar um título ao documento, mas pode ser confundido com o "
        "elemento <b>&lt;h1&gt;</b>, mas são coisas diferentes.",
    ], None),
    ("Metadados", [
        "<b>H1 vs TITLE</b>",
        "O elemento <b>&lt;h1&gt;</b> aparece na página quando é carregado no navegador — "
        "geralmente é usado uma vez por página, para marcar o título do conteúdo da sua "
        "página (o título da história, ou da notícia, por exemplo).",
    ], None),
    ("Metadados", [
        "<b>H1 vs TITLE</b>",
        "O elemento <b>&lt;title&gt;</b> é um metadado que representa o título de todo o documento "
        "HTML (não o conteúdo do documento).",
    ], None),
    ("Metadados", [
        "<b>H1 vs TITLE</b>",
    ], "Exemplo real: busca do Google por 'portal do estudante ifpb' — o resultado "
       "'Portal do Estudante | IFPB' vem do &lt;title&gt; da página; o título gigante "
       "'Portal do Estudante' dentro da página do IFPB é o &lt;h1&gt;."),
    ("Metadados", [
        "<b>H1 vs TITLE</b>",
        "Dependendo de onde está sendo visualizado, o elemento title é "
        "<b>dispensado</b>, pois não faz parte do corpo do texto.",
    ], "Visualização no Chrome Desktop (MacOS): o &lt;title&gt; aparece só na aba do navegador."),
    ("Metadados", [
        "<b>H1 vs TITLE</b>",
        "Dependendo de onde está sendo visualizado, o elemento title é "
        "<b>dispensado</b>, pois não faz parte do corpo do texto.",
    ], "Visualização no Safari (iOS): no modo leitura o &lt;title&gt; aparece no topo, "
       "fora do corpo da página."),
    ("Metadados", [
        "Metadados descrevem dados em HTML, que possui uma maneira "
        "oficial de adicionar metadados a um documento - o elemento "
        "<b>&lt;meta&gt;</b>.",
        "Outras tags também podem ser pensadas como metadados",
    ], None),
    ("Metadados", [
        "Metadados são úteis para "
        "que outros sites possam ler "
        "informações e <b>realizar "
        "atividades integradas</b>",
    ], "Exemplo: colar um link do Spotify num post do Facebook — o cartão com "
       "capa, título e artista do álbum vem dos metadados da página."),
    ("Metadados", [
        "<b>Exemplo:</b>",
        "<font face='Courier'> &lt;meta charset=\"utf-8\"&gt;</font>",
        "Especifica a codificação de caracteres do documento, ou seja, o conjunto de "
        "caracteres que o documento está autorizado a usar.",
        "<b>utf-8</b> é um conjunto de caracteres universal que inclui praticamente qualquer "
        "caractere de qualquer linguagem humana.",
    ], None),
    ("Metadados", [
        "Muitos elementos <b>&lt;meta&gt;</b> incluem atributos de name e content:",
        "O <b>name especifica o tipo de elemento</b> meta que é; que tipo de informação "
        "contém.",
        "O <b>content especifica o conteúdo</b> real do meta.",
    ], None),
    ("Metadados", [
        "Dois desses meta-elementos que são úteis para incluir na sua página "
        "definem o <b>autor da página</b> e fornecem uma <b>descrição</b> concisa da "
        "página.",
    ], None),
    ("Metadados", [
        "<b>Autor e descrição</b>",
        "<font face='Courier'> &lt;meta name=\"author\" content=\"Diogo\"&gt;</font>",
        "<font face='Courier'> &lt;meta name=\"description\"</font>",
        "<font face='Courier'>   content=\"Site da disciplina\"&gt;</font>",
    ], None),
    ("Metadados", [
        "<b>Outras metatags importantes</b>",
        "<b>Keywords</b>",
        "<font face='Courier'> &lt;meta name=\"keywords\" content=\"html, linguagens de marcação\"&gt;</font>",
        "Nesta metatag você colocará as <b>palavras chave</b> relativas ao assunto do site.",
    ], None),
    ("Metadados", [
        "<b>Outras metatags importantes</b>",
        "<b>Favicon</b>",
    ], "Exemplo: abas do Chrome com os favicons do TweetDeck, Pinterest e Reddit "
       "ao lado do título de cada página."),
    ("Metadados", [
        "<b>Outras metatags importantes</b>",
        "<b>Favicon</b>",
        "<font face='Courier'> &lt;link rel=\"icon\" href=\"icone.png\"&gt;</font>",
        "Um favicon é um pequeno ícone em forma quadrada de, normalmente, 16 pixels de "
        "altura e 16 pixels de largura",
    ], None),
    ("Prática", [
        "Crie um nova página HTML sobre algum conteúdo de sua "
        "preferência (séries, filmes, jogos, animes...) e adicione as "
        "seguintes metatags:",
        "<b>charset</b>",
        "<b>author, description</b>",
        "<b>keywords</b>",
        "<b>title</b>",
        "Além disso, adicione uma <b>imagem de sua preferência</b> "
        "como ícone",
    ], None),
]

def draw_page(canvas, doc):
    canvas.saveState()
    # barra superior vermelha (identidade IFPB dos slides)
    canvas.setFillColor(RED)
    canvas.rect(0, H - 6*mm, W, 6*mm, stroke=0, fill=1)
    # rodapé
    canvas.setStrokeColor(HexColor('#dadce0'))
    canvas.setLineWidth(0.6)
    canvas.line(18*mm, 14*mm, W - 18*mm, 14*mm)
    canvas.setFont('Helvetica', 8.5)
    canvas.setFillColor(GRAY)
    canvas.drawString(18*mm, 9.5*mm, 'Linguagens de Marcação - Prof. MSc. Diogo D. Moreira')
    canvas.drawRightString(W - 18*mm, 9.5*mm, str(doc.page))
    canvas.restoreState()

doc = SimpleDocTemplate(
    "/home/z/my-project/public/pdfs/lm-html-07-metadados.pdf",
    pagesize=landscape(A4), leftMargin=22*mm, rightMargin=22*mm,
    topMargin=20*mm, bottomMargin=20*mm, title="HTML - Metadados (Linguagens de Marcação)")

h1 = ParagraphStyle('h1', fontName='Helvetica-Bold', fontSize=30, leading=34, textColor=DARK, spaceAfter=6)
h2 = ParagraphStyle('h2', fontName='Helvetica-Bold', fontSize=16, leading=20, textColor=DARK, spaceAfter=10)
bullet = ParagraphStyle('b', fontName='Helvetica', fontSize=13.5, leading=19, textColor=GRAY, leftIndent=6*mm, bulletIndent=1.5*mm, spaceAfter=8)
caption = ParagraphStyle('c', fontName='Helvetica-Oblique', fontSize=10.5, leading=14, textColor=DARK, leftIndent=6*mm, spaceBefore=10)

story = []
# Capa (slide 1)
story.append(Spacer(1, 55*mm))
story.append(Paragraph('HTML', ParagraphStyle('cap', parent=h1, fontSize=54, leading=58)))
story.append(Paragraph('Metadados', ParagraphStyle('sub', parent=h1, fontSize=34, leading=40, textColor=GRAY)))
story.append(PageBreak())

for i, (title, bullets, visual) in enumerate(SLIDES):
    is_pratica = title == 'Prática'
    story.append(Paragraph(title, h1 if not is_pratica else ParagraphStyle('p', parent=h1, fontSize=40, leading=44)))
    if visual:
        story.append(Paragraph(f'• {bullets[0]}', bullet) if bullets else Spacer(1, 4*mm))
        story.append(Spacer(1, 14*mm))
        story.append(Paragraph(f'[Imagem do slide] {visual}', caption))
    else:
        for b in bullets:
            story.append(Paragraph(b, bullet, bulletText='●'))
    if i < len(SLIDES) - 1:
        story.append(PageBreak())

doc.build(story, onFirstPage=draw_page, onLaterPages=draw_page)
print(f"PDF gerado: {1 + len(SLIDES)} slides")

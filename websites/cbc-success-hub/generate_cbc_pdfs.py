from pathlib import Path
import json, os
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, HRFlowable

ROOT=Path("/var/lib/cbc-success-hub")
PDFDIR=ROOT/"pdfs"
DATA=json.loads((ROOT/"papers.json").read_text(encoding="utf-8"))
PDFDIR.mkdir(parents=True,exist_ok=True)

font_regular="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
font_bold="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
font_serif="/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
font_serif_bold="/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
if Path(font_regular).exists():
    pdfmetrics.registerFont(TTFont("StudySans",font_regular))
    pdfmetrics.registerFont(TTFont("StudySans-Bold",font_bold))
    pdfmetrics.registerFont(TTFont("StudySerif",font_serif))
    pdfmetrics.registerFont(TTFont("StudySerif-Bold",font_serif_bold))
    REG,BOLD,SERIF,SERIFB="StudySans","StudySans-Bold","StudySerif","StudySerif-Bold"
else:
    REG,BOLD,SERIF,SERIFB="Helvetica","Helvetica-Bold","Times-Roman","Times-Bold"

forest=colors.HexColor("#145d42")
ink=colors.HexColor("#1d2924")
muted=colors.HexColor("#617168")
line=colors.HexColor("#cfd7ce")
light=colors.HexColor("#f0f5ef")

styles={
 "title":ParagraphStyle("Title",fontName=SERIFB,fontSize=15,leading=19,alignment=TA_CENTER,textColor=ink,spaceAfter=3),
 "title2":ParagraphStyle("Title2",fontName=BOLD,fontSize=10,leading=13,alignment=TA_CENTER,textColor=forest,spaceAfter=5),
 "notice":ParagraphStyle("Notice",fontName=BOLD,fontSize=8.4,leading=11,alignment=TA_CENTER,textColor=colors.HexColor("#8a3d28"),spaceAfter=9),
 "meta":ParagraphStyle("Meta",fontName=REG,fontSize=8.5,leading=12,textColor=ink,spaceAfter=2),
 "instructions":ParagraphStyle("Instructions",fontName=REG,fontSize=8.6,leading=12,textColor=ink,spaceAfter=2),
 "qhead":ParagraphStyle("Qhead",fontName=BOLD,fontSize=10.5,leading=13,textColor=forest,spaceBefore=7,spaceAfter=4,keepWithNext=True),
 "q":ParagraphStyle("Question",fontName=SERIF,fontSize=10.2,leading=15,textColor=ink,spaceAfter=4),
 "answer":ParagraphStyle("Answer",fontName=SERIF,fontSize=9.7,leading=14,textColor=ink,spaceAfter=8),
 "answerlabel":ParagraphStyle("AnswerLabel",fontName=BOLD,fontSize=9,leading=12,textColor=forest,spaceBefore=6,spaceAfter=3,keepWithNext=True),
 "small":ParagraphStyle("Small",fontName=REG,fontSize=7.6,leading=10,textColor=muted),
}

def P(text, style):
    safe=escape(str(text)).replace("\n","<br/>")
    return Paragraph(safe,styles[style])

def page_art(canvas,doc):
    canvas.saveState()
    w,h=A4
    # Keep the question area clear; branding appears in the header and footer.
    canvas.saveState()
    canvas.setStrokeColor(line); canvas.setLineWidth(.5)
    canvas.line(19*mm,15*mm,w-19*mm,15*mm)
    canvas.setFont(REG,7.2); canvas.setFillColor(muted)
    canvas.drawString(19*mm,10*mm,"CBC SUCCESS HUB  |  ORIGINAL REVISION MATERIAL  |  NOT AN OFFICIAL KNEC PAPER")
    canvas.drawRightString(w-19*mm,10*mm,f"Page {doc.page}")
    canvas.restoreState()

def doc_base(path, story):
    doc=SimpleDocTemplate(str(path),pagesize=A4,leftMargin=19*mm,rightMargin=19*mm,topMargin=17*mm,bottomMargin=22*mm,
                          title=path.stem.replace("_"," "),author="CBC Success Hub")
    doc.build(story,onFirstPage=page_art,onLaterPages=page_art)

def build_header(p, paper_key, answer=False):
    label="MARKING SCHEME / ANSWER GUIDE" if answer else "QUESTION PAPER"
    story=[
      P("CBC SUCCESS HUB", "title"),
      P(p.get("title","Practice Paper"),"title2"),
      P("ORIGINAL PRACTICE RESOURCE  |  NOT AN OFFICIAL KNEC EXAMINATION", "notice"),
      HRFlowable(width="100%",thickness=1.2,color=ink,spaceBefore=0,spaceAfter=8),
      P(label.upper(),"title2"),
    ]
    total=sum(int(q.get("m",0)) for q in p.get("questions",[]))
    info=[["SUBJECT / RESOURCE",p.get("subject","As shown in title"),"TIME",str(p.get("duration",40))+" minutes"],
          ["TOTAL MARKS",str(p.get("marks",total)),"QUESTION PARTS",str(len(p.get("questions",[])))]]
    t=Table(info,colWidths=[38*mm,55*mm,34*mm,45*mm],hAlign="LEFT")
    t.setStyle(TableStyle([
      ("FONTNAME",(0,0),(-1,-1),REG),("FONTNAME",(0,0),(0,-1),BOLD),("FONTNAME",(2,0),(2,-1),BOLD),
      ("FONTSIZE",(0,0),(-1,-1),7.4),("TEXTCOLOR",(0,0),(0,-1),forest),("TEXTCOLOR",(2,0),(2,-1),forest),
      ("BACKGROUND",(0,0),(-1,-1),light),("GRID",(0,0),(-1,-1),.35,line),
      ("VALIGN",(0,0),(-1,-1),"MIDDLE"),("LEFTPADDING",(0,0),(-1,-1),6),("RIGHTPADDING",(0,0),(-1,-1),6),
      ("TOPPADDING",(0,0),(-1,-1),6),("BOTTOMPADDING",(0,0),(-1,-1),6)
    ]))
    story.extend([t,Spacer(1,9)])
    if not answer:
      cand=[["Candidate name: __________________________________________","Admission / index no.: __________________________"],
            ["School: _________________________________________________","Date: __________________________________________"]]
      ct=Table(cand,colWidths=[75*mm,77*mm],hAlign="LEFT")
      ct.setStyle(TableStyle([("FONTNAME",(0,0),(-1,-1),SERIF),("FONTSIZE",(0,0),(-1,-1),8),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5)]))
      story.extend([ct,Spacer(1,5),P("INSTRUCTIONS TO CANDIDATES","qhead"),P(p.get("instructions","Answer all questions. Show all working."),"instructions"),P("Answer all questions. Show necessary working. Marks for each question are shown in brackets. Use additional working space as required.","instructions"),Spacer(1,4),HRFlowable(width="100%",thickness=.5,color=line,spaceAfter=6)])
    else:
      story.extend([P("GUIDANCE FOR SELF-MARKING AND TEACHER REVIEW","qhead"),
        P("These are suggested answers and indicative marks for original practice questions. Credit mathematically valid alternatives and clear equivalent reasoning where appropriate.","instructions"),
        Spacer(1,4),HRFlowable(width="100%",thickness=.5,color=line,spaceAfter=6)])
    if p.get("kind") == "trend_pack":
      story.extend([
        P("QUALITATIVE KCSE TOPIC REVIEW | 2016-2025","qhead"),
        P(p.get("trend_summary","Subject-specific topic emphasis for revision."),"instructions"),
        P(p.get("trend_methodology","This is a qualitative revision guide, not a numerical frequency count or a guarantee of future examination content."),"small"),
        Spacer(1,5), HRFlowable(width="100%",thickness=.5,color=line,spaceAfter=6)
      ])
    return story

def build_questions(key,p):
    story=build_header(p,key,False)
    for i,q in enumerate(p.get("questions",[]),1):
      text=q.get("q","")
      story.append(P(f"QUESTION {i}  [{q.get('m',0)} MARKS]","qhead"))
      story.append(P(text,"q"))
      # Ruled response space scales with the mark allocation. Extended writing tasks get a
      # larger writing area; calculations get concise, ruled work lines.
      m=int(q.get("m",2))
      subject=str(p.get("subject","")).lower()
      qtext=str(q.get("q","")).lower()
      extended_writing = (("english" in subject) and any(term in qtext for term in
          ("composition", "write a balanced argument", "write a narrative", "write a formal letter",
           "write a summary", "write 100", "write 120", "write 250", "write 350")))
      if extended_writing:
          line_count=max(8,min(20,int(round(m*0.55))))
      elif "english" in subject and m >= 12:
          line_count=max(7,min(12,int(round(m*0.55))))
      else:
          line_count=max(4,min(9,int((m+1)//2)))
      row_h=5.6*mm
      work=Table([[""] for _ in range(line_count)],colWidths=[170*mm],
                 rowHeights=[row_h]*line_count,hAlign="LEFT")
      work.setStyle(TableStyle([
          ("LINEBELOW",(0,0),(-1,-1),.35,colors.HexColor("#d7ddd5")),
          ("BOX",(0,0),(-1,-1),.35,colors.HexColor("#d7ddd5")),
          ("LEFTPADDING",(0,0),(-1,-1),2),("RIGHTPADDING",(0,0),(-1,-1),2),
          ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
          ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
          ("BACKGROUND",(0,0),(-1,-1),colors.white)
      ]))
      story.extend([work,Spacer(1,4)])
    story.extend([Spacer(1,8),P("END OF QUESTION PAPER","title2"),P("Check that you have answered every question. The separate marking scheme is a different PDF file.","small")])
    doc_base(PDFDIR/f"{key}_paper.pdf",story)

def build_answers(key,p):
    story=build_header(p,key,True)
    for i,q in enumerate(p.get("questions",[]),1):
      story.append(P(f"QUESTION {i}  [{q.get('m',0)} MARKS]","answerlabel"))
      story.append(P("Question: "+q.get("q",""),"small"))
      story.append(Spacer(1,3))
      story.append(P("SUGGESTED WORKING / MARKING GUIDE","answerlabel"))
      story.append(P(q.get("a","No worked answer supplied; use teacher review."),"answer"))
      story.append(HRFlowable(width="100%",thickness=.35,color=line,spaceAfter=4))
    story.extend([Spacer(1,6),P("END OF MARKING SCHEME","title2"),P("This is an independently written practice guide, not an official KNEC marking scheme.","small")])
    doc_base(PDFDIR/f"{key}_answers.pdf",story)

for key,p in DATA.items():
    calculated=sum(int(q.get("m",0)) for q in p.get("questions",[]))
    declared=int(p.get("marks",calculated))
    if calculated != declared:
        raise ValueError(f"{key}: declared total {declared} does not match question marks {calculated}")
    build_questions(key,p)
    build_answers(key,p)
    qpath=PDFDIR/f"{key}_paper.pdf"; apath=PDFDIR/f"{key}_answers.pdf"
    print(f"built {key}: paper={qpath.stat().st_size}B answers={apath.stat().st_size}B")
print("TOTAL_PDFS",len(list(PDFDIR.glob("*.pdf"))))


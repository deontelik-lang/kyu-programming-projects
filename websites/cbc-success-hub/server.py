from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import json, sqlite3, uuid, secrets, hmac, re, os

APP_ROOT=Path("/app")
ROOT=Path("/var/lib/cbc-success-hub")
PDF_ROOT=ROOT/"pdfs"
DB_PATH=ROOT/"orders.sqlite3"
TOKEN_PATH=ROOT/"admin_token"
PAPERS=json.loads((ROOT/"papers.json").read_text(encoding="utf-8"))
PORT=int(os.environ.get("PORT","8080"))
ROOT.mkdir(parents=True,exist_ok=True)
PDF_ROOT.mkdir(parents=True,exist_ok=True)
if not TOKEN_PATH.exists():
    token=secrets.token_urlsafe(36)
    TOKEN_PATH.write_text(token,encoding="utf-8")
    os.chmod(TOKEN_PATH,0o600)
    print("Generated private admin token at the protected data path.",flush=True)

def now_local():
    return datetime.now(ZoneInfo("Africa/Nairobi")).isoformat(timespec="seconds")
def normalize_phone(phone):
    digits=re.sub(r"\D","",str(phone or ""))
    if digits.startswith("254") and len(digits)>=12: digits=digits[-9:]
    elif digits.startswith("0") and len(digits)==10: digits=digits[1:]
    return digits
def normalize_code(code):
    return re.sub(r"[^A-Z0-9]","",str(code or "").upper())
def connect_db():
    db=sqlite3.connect(DB_PATH,timeout=10)
    db.row_factory=sqlite3.Row
    return db
def init_db():
    with connect_db() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS orders(
          id TEXT PRIMARY KEY,paper_key TEXT NOT NULL,paper_title TEXT NOT NULL,
          name TEXT NOT NULL,phone TEXT NOT NULL,mpesa_code TEXT NOT NULL UNIQUE COLLATE NOCASE,
          amount INTEGER NOT NULL CHECK(amount=30),
          status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','VERIFIED','REJECTED')),
          created_at TEXT NOT NULL,verified_at TEXT,verification_note TEXT)""")
        db.execute("CREATE INDEX IF NOT EXISTS idx_csh_orders_phone ON orders(phone)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_csh_orders_status ON orders(status)")
def read_json(handler,max_bytes=16000):
    length=int(handler.headers.get("Content-Length","0") or "0")
    if length<=0 or length>max_bytes: raise ValueError("Invalid request size.")
    data=json.loads(handler.rfile.read(length).decode("utf-8"))
    if not isinstance(data,dict): raise ValueError("Expected a JSON object.")
    return data
def safe_json(handler,status,payload):
    raw=json.dumps(payload,ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type","application/json; charset=utf-8")
    handler.send_header("Content-Length",str(len(raw)))
    handler.send_header("Cache-Control","no-store")
    handler.send_header("X-Content-Type-Options","nosniff")
    handler.end_headers()
    handler.wfile.write(raw)

class Handler(SimpleHTTPRequestHandler):
    server_version="CBCSuccessHub/1.0"
    sys_version=""
    def admin_ok(self):
        supplied=self.headers.get("X-Admin-Token","")
        try: expected=TOKEN_PATH.read_text(encoding="utf-8").strip()
        except OSError: return False
        return bool(supplied and hmac.compare_digest(supplied,expected))
    def do_GET(self):
        path=unquote(urlparse(self.path).path)
        if path=="/exams/api/health":
            return safe_json(self,200,{"ok":True,"payments":"manual_receipt_verification","pdfBundles":len(PAPERS)})
        if path=="/exams/api/admin/orders":
            if not self.admin_ok(): return safe_json(self,401,{"error":"Admin authentication required."})
            with connect_db() as db:
                rows=db.execute("SELECT id,paper_key,paper_title,name,phone,mpesa_code,amount,status,created_at,verified_at FROM orders ORDER BY created_at DESC LIMIT 200").fetchall()
            return safe_json(self,200,{"orders":[dict(row) for row in rows]})
        m=re.fullmatch(r"/exams/api/orders/([0-9a-fA-F-]{36})",path)
        if m:
            with connect_db() as db: row=db.execute("SELECT id,paper_key,paper_title,status,created_at FROM orders WHERE id=?",(m.group(1),)).fetchone()
            if not row: return safe_json(self,404,{"error":"Order not found."})
            return safe_json(self,200,{"orderId":row["id"],"paperKey":row["paper_key"],"title":row["paper_title"],"status":row["status"],"createdAt":row["created_at"]})
        m=re.fullmatch(r"/exams/download/([0-9a-fA-F-]{36})/(paper|answers)",path)
        if m:
            order_id,kind=m.group(1),m.group(2)
            with connect_db() as db: row=db.execute("SELECT paper_key,paper_title,status FROM orders WHERE id=?",(order_id,)).fetchone()
            if not row: return safe_json(self,404,{"error":"Order not found."})
            if row["status"]!="VERIFIED": return safe_json(self,403,{"error":"Payment is not verified. Downloads remain locked."})
            suffix="paper" if kind=="paper" else "answers"
            pdf=PDF_ROOT/(row["paper_key"]+"_"+suffix+".pdf")
            if not pdf.is_file(): return safe_json(self,404,{"error":"This PDF file is not available."})
            content=pdf.read_bytes()
            stem=re.sub(r"[^A-Za-z0-9_-]+","-",row["paper_title"]).strip("-")[:70] or "CBC-paper"
            ending="Question-Paper" if kind=="paper" else "Marking-Scheme"
            filename=stem+"-"+ending+".pdf"
            self.send_response(200)
            self.send_header("Content-Type","application/pdf")
            self.send_header("Content-Length",str(len(content)))
            self.send_header("Content-Disposition",'attachment; filename="'+filename+'"')
            self.send_header("Cache-Control","private, no-store")
            self.send_header("X-Content-Type-Options","nosniff")
            self.end_headers()
            self.wfile.write(content)
            return
        if path in ("/server.py","/generate_cbc_pdfs.py","/cbc-success-hub-server.log","/cbc-success-hub-server.pid","/server.log","/orders.sqlite3","/papers.json","/admin_token") or any(part.startswith(".") for part in Path(path).parts if part not in ("/",".","..")):
            self.send_error(404,"Not found")
            return
        return super().do_GET()
    def do_POST(self):
        path=unquote(urlparse(self.path).path)
        try: data=read_json(self)
        except (ValueError,UnicodeDecodeError,json.JSONDecodeError) as exc:
            return safe_json(self,400,{"error":str(exc) or "Invalid JSON."})
        if path=="/exams/api/orders":
            key=str(data.get("paperKey","")); paper=PAPERS.get(key)
            if not paper: return safe_json(self,400,{"error":"This paper bundle is not available for purchase yet."})
            name=re.sub(r"\s+"," ",str(data.get("name","")).strip())[:100]
            phone=normalize_phone(data.get("phone")); code=normalize_code(data.get("mpesaCode"))
            if len(name)<2: return safe_json(self,400,{"error":"Enter your name."})
            if len(phone)<9 or len(phone)>12: return safe_json(self,400,{"error":"Enter a valid M-Pesa phone number."})
            if len(code)<8 or len(code)>14: return safe_json(self,400,{"error":"Enter the M-Pesa receipt confirmation code."})
            order_id=str(uuid.uuid4()); title=str(paper.get("title",key))[:180]; created=now_local()
            try:
                with connect_db() as db:
                    db.execute("INSERT INTO orders(id,paper_key,paper_title,name,phone,mpesa_code,amount,status,created_at) VALUES(?,?,?,?,?,?,30,'PENDING',?)",(order_id,key,title,name,phone,code,created))
            except sqlite3.IntegrityError:
                return safe_json(self,409,{"error":"That M-Pesa receipt code has already been submitted. Open My Orders to check its status or contact support."})
            return safe_json(self,201,{"orderId":order_id,"status":"PENDING","title":title,"amount":30,"createdAt":created,"message":"Receipt received for manual verification. PDF downloads remain locked until verified."})
        if path=="/exams/api/orders/lookup":
            phone=normalize_phone(data.get("phone")); code=normalize_code(data.get("mpesaCode"))
            if len(phone)<9 or len(code)<8: return safe_json(self,400,{"error":"Enter the phone number and M-Pesa receipt code used for this order."})
            with connect_db() as db: row=db.execute("SELECT id,paper_key,paper_title,status,amount,created_at FROM orders WHERE phone=? AND mpesa_code=?",(phone,code)).fetchone()
            if not row: return safe_json(self,404,{"error":"No order matched that phone number and receipt code."})
            return safe_json(self,200,{"orderId":row["id"],"paperKey":row["paper_key"],"title":row["paper_title"],"status":row["status"],"amount":row["amount"],"createdAt":row["created_at"]})
        if path in ("/exams/api/admin/verify","/exams/api/admin/reject"):
            if not self.admin_ok(): return safe_json(self,401,{"error":"Admin authentication required."})
            order_id=str(data.get("orderId",""))
            with connect_db() as db:
                row=db.execute("SELECT id,mpesa_code,status FROM orders WHERE id=?",(order_id,)).fetchone()
                if not row: return safe_json(self,404,{"error":"Order not found."})
                if row["status"]!="PENDING": return safe_json(self,409,{"error":"Only pending orders can be changed."})
                if path.endswith("/verify"):
                    actual=normalize_code(data.get("actualReceiptCode"))
                    note=re.sub(r"[\r\n]+"," ",str(data.get("note","")).strip())[:300]
                    if not actual or not hmac.compare_digest(actual,normalize_code(row["mpesa_code"])):
                        return safe_json(self,400,{"error":"The confirmed receipt code does not match the submitted receipt code."})
                    if len(note)<8: return safe_json(self,400,{"error":"Enter a note confirming you checked the transaction against the merchant M-Pesa records."})
                    db.execute("UPDATE orders SET status='VERIFIED',verified_at=?,verification_note=? WHERE id=?",(now_local(),note,order_id))
                    return safe_json(self,200,{"ok":True,"status":"VERIFIED","orderId":order_id})
                note=re.sub(r"[\r\n]+"," ",str(data.get("note","Receipt could not be verified")).strip())[:300]
                db.execute("UPDATE orders SET status='REJECTED',verified_at=?,verification_note=? WHERE id=?",(now_local(),note,order_id))
                return safe_json(self,200,{"ok":True,"status":"REJECTED","orderId":order_id})
        return safe_json(self,404,{"error":"Endpoint not found."})

init_db()
os.chdir(APP_ROOT)
httpd=ThreadingHTTPServer(("0.0.0.0",PORT),Handler)
print(f"CBC Success Hub server listening on 0.0.0.0:{PORT}; {len(PAPERS)} private PDF bundles ready.",flush=True)
httpd.serve_forever()


import os
import io
import math
import csv
import datetime
import requests
from dotenv import load_dotenv
load_dotenv()
os.environ["GRPC_DNS_RESOLVER"] = "native"

from flask import Flask, request, jsonify, send_file, make_response
from flask_cors import CORS
from firebase_admin import firestore
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.platypus import Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from firebase_config import db

app = Flask(__name__)
CORS(app)

# Register Unicode font for ₹ symbol support
_FONT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ArialUnicode.ttf')
if os.path.exists(_FONT_PATH):
    pdfmetrics.registerFont(TTFont('UniFont', _FONT_PATH))
    pdfmetrics.registerFont(TTFont('UniFont-Bold', _FONT_PATH))  # same file, bold via size
    PDF_FONT = 'UniFont'
else:
    PDF_FONT = 'Helvetica'  # fallback (no ₹)

RS = '\u20b9'  # ₹ character

# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def number_to_words(n):
    ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
            'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
            'Seventeen', 'Eighteen', 'Nineteen']
    tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

    def _below_thousand(num):
        if num == 0:
            return ''
        elif num < 20:
            return ones[num]
        elif num < 100:
            return tens[num // 10] + ((' ' + ones[num % 10]) if num % 10 else '')
        else:
            rest = _below_thousand(num % 100)
            return ones[num // 100] + ' Hundred' + ((' and ' + rest) if rest else '')

    if n == 0:
        return 'Zero'
    parts = []
    if n >= 10000000:
        parts.append(_below_thousand(n // 10000000) + ' Crore')
        n %= 10000000
    if n >= 100000:
        parts.append(_below_thousand(n // 100000) + ' Lakh')
        n %= 100000
    if n >= 1000:
        parts.append(_below_thousand(n // 1000) + ' Thousand')
        n %= 1000
    if n > 0:
        parts.append(_below_thousand(n))
    return ' '.join(parts)

def amount_in_words(amount):
    rupees = int(amount)
    paise = round((amount - rupees) * 100)
    words = number_to_words(rupees) + ' Rupees'
    if paise:
        words += ' and ' + number_to_words(paise) + ' Paise'
    return words + ' Only'

COMPANY = {
    'name': 'VELUR SPUN PIPES',
    'address': '220/100-C Paundamangalam Road, Santhi Nagar, Paramathi Velur, Pothanur, Namakkal-638181-Tamil Nadu',
    'phone': '8883123667',
    'gstin': '33AKDPR4705J1Z6',
    'state': '33-Tamil Nadu',
    'email': 'velurspunpipes@gmail.com',
}
HSN = '68109990'

# ─────────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────────

@app.route('/')
def home():
    return '<h1>Velur Spun Pipes Backend</h1>'

@app.route('/api/login', methods=['POST'])
def admin_login():
    try:
        data = request.json
        email = data.get('email', '').strip().lower()
        password = data.get('password', '').strip()

        if email == os.getenv('ADMIN_EMAIL') and password == os.getenv('ADMIN_PASSWORD'):
            return jsonify({"success": True, "user": {"id": "admin-1", "email": email, "name": "Admin", "role": "admin"}})

        API_KEY = os.getenv('FIREBASE_API_KEY')
        res = requests.post(
            f'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={API_KEY}',
            json={"email": email, "password": password, "returnSecureToken": True}
        )
        if res.status_code == 200:
            d = res.json()
            return jsonify({"success": True, "user": {"id": d.get('localId'), "email": d.get('email'), "name": "Admin", "role": "admin"}})
        return jsonify({"success": False, "error": "Invalid credentials"}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ─────────────────────────────────────────────
# ITEMS (INVENTORY)
# ─────────────────────────────────────────────

@app.route('/api/items', methods=['GET'])
def get_items():
    try:
        items = [{'id': doc.id, **doc.to_dict()} for doc in db.collection('items').stream()]
        return jsonify(items)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/add_item', methods=['POST'])
def add_item():
    try:
        d = request.json
        db.collection('items').add({
            'name': d['name'],
            'price': float(d['price']),
            'stock': int(d.get('stock', 0)),
            'gst': float(d.get('gst', 18))
        })
        return jsonify({"success": True}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/update_item/<item_id>', methods=['PUT'])
def update_item(item_id):
    try:
        d = request.json
        db.collection('items').document(item_id).update({
            'name': d['name'],
            'price': float(d['price']),
            'stock': int(d['stock']),
            'gst': float(d.get('gst', 18))
        })
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/delete_item/<item_id>', methods=['DELETE'])
def delete_item(item_id):
    try:
        db.collection('items').document(item_id).delete()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ─────────────────────────────────────────────
# PARTIES (CUSTOMERS)
# ─────────────────────────────────────────────

@app.route('/api/parties', methods=['GET'])
def get_parties():
    try:
        parties = [{'id': doc.id, **doc.to_dict()} for doc in db.collection('parties').stream()]
        return jsonify(parties)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/add_party', methods=['POST'])
def add_party():
    try:
        d = request.json
        name = d.get('name', '').strip()
        name_lower = name.lower()
        existing = list(db.collection('parties').where('name_lower', '==', name_lower).stream())
        if existing:
            return jsonify({"success": False, "error": "Customer already exists."}), 400
        _, doc_ref = db.collection('parties').add({
            'name': name,
            'name_lower': name_lower,
            'gst_number': d.get('gst_number', ''),
            'customer_email': d.get('customer_email', ''),
            'phone_number': d.get('phone_number', ''),
            'billing_address': d.get('billing_address', ''),
            'shipping_address': d.get('shipping_address', ''),
            'vehicle_number': d.get('vehicle_number', ''),
            'eway_number': d.get('eway_number', ''),
            'created_at': firestore.SERVER_TIMESTAMP
        })
        return jsonify({"success": True, "id": doc_ref.id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/parties/<party_id>', methods=['PUT'])
def update_party(party_id):
    try:
        d = request.json
        name = d.get('name', '').strip()
        db.collection('parties').document(party_id).update({
            'name': name,
            'name_lower': name.lower(),
            'gst_number': d.get('gst_number', ''),
            'customer_email': d.get('customer_email', ''),
            'phone_number': d.get('phone_number', ''),
            'billing_address': d.get('billing_address', ''),
            'shipping_address': d.get('shipping_address', ''),
            'vehicle_number': d.get('vehicle_number', ''),
            'eway_number': d.get('eway_number', ''),
        })
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/parties/<party_id>', methods=['DELETE'])
def delete_party(party_id):
    try:
        db.collection('parties').document(party_id).delete()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ─────────────────────────────────────────────
# SALES
# ─────────────────────────────────────────────

@app.route('/api/dashboard_stats', methods=['GET'])
def dashboard_stats():
    try:
        today_str = datetime.datetime.now().strftime('%Y-%m-%d')
        total_revenue = 0
        today_sales = 0
        total_orders = 0
        for doc in db.collection('sales').stream():
            d = doc.to_dict()
            if d.get('doc_type') == 'Estimation':
                continue
            total_orders += 1
            grand = float(d.get('grand_total', 0))
            total_revenue += grand
            ca = d.get('created_at')
            if ca and hasattr(ca, 'strftime') and ca.strftime('%Y-%m-%d') == today_str:
                today_sales += grand
        return jsonify({"total_revenue": total_revenue, "today_sales": today_sales, "total_orders": total_orders})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/sales', methods=['GET'])
def get_sales():
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        search = request.args.get('search', '').strip().lower()
        offset = (page - 1) * limit

        all_docs = list(db.collection('sales').order_by('created_at', direction=firestore.Query.DESCENDING).stream())

        sales = []
        for doc in all_docs:
            s = doc.to_dict()
            s['id'] = doc.id
            if s.get('created_at'):
                s['created_at'] = s['created_at'].strftime('%Y-%m-%d')
            sales.append(s)

        if search:
            sales = [s for s in sales if search in s.get('party_name', '').lower()]

        total_items = len(sales)
        total_pages = math.ceil(total_items / limit) if limit > 0 else 1
        sliced = sales[offset: offset + limit]

        return jsonify({"sales": sliced, "total_pages": total_pages, "current_page": page, "total_items": total_items})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/sales/party/<party_name>', methods=['GET'])
def get_party_sales(party_name):
    try:
        docs = db.collection('sales').where('party_name', '==', party_name).stream()
        sales = []
        for doc in docs:
            s = doc.to_dict()
            s['id'] = doc.id
            if s.get('created_at'):
                s['created_at'] = s['created_at'].strftime('%Y-%m-%d')
            sales.append(s)
        sales.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        return jsonify(sales)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/save_sale', methods=['POST'])
def save_sale():
    try:
        data = request.json
        doc_type = data.get('doc_type', 'Tax Invoice')
        items_req = data.get('items', [])
        if not items_req:
            return jsonify({"success": False, "error": "No items in cart"}), 400

        subtotal = 0
        validated_items = []
        batch = db.batch()

        for item in items_req:
            item_docs = list(db.collection('items').where('name', '==', item['name']).limit(1).stream())
            if not item_docs:
                return jsonify({"success": False, "error": f"Item '{item['name']}' not found"}), 400

            db_doc = item_docs[0]
            db_item = db_doc.to_dict()
            db_price = float(db_item.get('price', 0))
            current_stock = int(db_item.get('stock', 0))
            req_qty = int(item.get('qty', 0))

            if req_qty <= 0:
                return jsonify({"success": False, "error": f"Invalid qty for {item['name']}"}), 400

            if doc_type == 'Tax Invoice':
                if req_qty > current_stock:
                    return jsonify({"success": False, "error": f"Insufficient stock for {item['name']}. Available: {current_stock}"}), 400
                batch.update(db_doc.reference, {'stock': current_stock - req_qty})

            base = db_price * req_qty
            discount_pct = float(item.get('discount_pct', 0))
            discount_amt = round(base * discount_pct / 100, 2)
            taxable = base - discount_amt
            tax_pct = float(item.get('tax_pct', 18))
            tax_amt = round(taxable * tax_pct / 100, 2)
            line_total = round(taxable + tax_amt, 2)
            subtotal += taxable  # subtotal = sum of taxable amounts
            validated_items.append({
                'name': item['name'],
                'hsn': HSN,
                'description': item.get('description', ''),
                'qty': req_qty,
                'unit': item.get('unit', 'Nos'),
                'price': db_price,
                'discount_pct': discount_pct,
                'discount_amt': discount_amt,
                'tax_pct': tax_pct,
                'tax_amt': tax_amt,
                'amount': line_total
            })

        total_tax = sum(i['tax_amt'] for i in validated_items)
        cgst = round(total_tax / 2, 2)
        sgst = round(total_tax / 2, 2)
        grand_total = round(sum(i['amount'] for i in validated_items), 2)
        advance = float(data.get('advance_payment', 0))
        balance_due = round(grand_total - advance, 2)

        sale_data = {
            'party_name': data.get('party_name', ''),
            'billing_address': data.get('billing_address', ''),
            'shipping_address': data.get('shipping_address', ''),
            'vehicle_number': data.get('vehicle_number', ''),
            'eway_number': data.get('eway_number', ''),
            'gst_number': data.get('gst_number', ''),
            'items': validated_items,
            'subtotal': subtotal,
            'cgst': cgst,
            'sgst': sgst,
            'grand_total': grand_total,
            'advance_payment': advance,
            'balance_due': balance_due,
            'notes': data.get('notes', ''),
            'status': 'Completed',
            'doc_type': doc_type,
            'created_at': firestore.SERVER_TIMESTAMP
        }

        # ── Sequential invoice number (atomic transaction) ────────────────
        counter_ref = db.collection('counters').document('invoice_counter')

        @firestore.transactional
        def get_next_number(transaction, ref):
            snapshot = ref.get(transaction=transaction)
            next_num = (snapshot.get('value') or 0) + 1 if snapshot.exists else 1
            transaction.set(ref, {'value': next_num})
            return next_num

        transaction = db.transaction()
        next_num = get_next_number(transaction, counter_ref)
        sale_data['invoice_number'] = next_num

        _, doc_ref = db.collection('sales').add(sale_data)
        if doc_type == 'Tax Invoice':
            batch.commit()

        return jsonify({"success": True, "id": doc_ref.id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/export_sales', methods=['GET'])
def export_sales():
    try:
        docs = list(db.collection('sales').order_by('created_at', direction=firestore.Query.DESCENDING).stream())
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Date', 'Invoice Number', 'Party Name', 'Amount', 'Balance'])
        for doc in docs:
            d = doc.to_dict()
            date_val = d.get('created_at')
            date_str = date_val.strftime('%d/%m/%Y') if date_val and hasattr(date_val, 'strftime') else ''
            writer.writerow([
                date_str,
                d.get('invoice_number', doc.id[:8].upper()),
                d.get('party_name', ''),
                d.get('grand_total', 0),
                d.get('balance_due', 0)
            ])
        output.seek(0)
        response = make_response(output.getvalue())
        response.headers['Content-Disposition'] = 'attachment; filename=sales_export.csv'
        response.headers['Content-Type'] = 'text/csv'
        return response
    except Exception as e:
        return jsonify({"error": str(e)}), 500




# ─────────────────────────────────────────────
# PDF GENERATION — TAX INVOICE (Tally-style)
# ─────────────────────────────────────────────



# ─────────────────────────────────────────────
# PDF GENERATION — TAX INVOICE
# ─────────────────────────────────────────────





# ─────────────────────────────────────────────
# PDF GENERATION  –  Tally-style Tax Invoice & Estimate
# ─────────────────────────────────────────────
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm

# ── helpers ──────────────────────────────────────────────────────────────────


# ═══════════════════════════════════════════════════════════════════════════
#  Tally-Style PDF  –  Tax Invoice  &  Estimate
#  Uses only Helvetica (built-in) so Rs. is used instead of ₹
# ═══════════════════════════════════════════════════════════════════════════
from reportlab.platypus import Paragraph, Spacer
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

# ── number-to-words helper ───────────────────────────────────────────────────

# ═══════════════════════════════════════════════════════════════════════════
#  Tally-Style PDF  –  Tax Invoice & Estimate  (with signature image)
#  Uses Helvetica only → Rs. instead of ₹ (no font issues)
# ═══════════════════════════════════════════════════════════════════════════
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.lib.utils import ImageReader

# ── signature image path ─────────────────────────────────────────────────────
import os as _os
_SIG_BASE = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'static', 'images', 'signature')
SIGNATURE_IMAGE_PATH = next(
    (p for ext in ('.jpeg', '.jpg', '.png') if _os.path.exists(p := _SIG_BASE + ext)),
    _SIG_BASE + '.jpeg'   # fallback (will show missing-file error clearly)
)

# ── number-to-words ──────────────────────────────────────────────────────────
def _n2w(n):
    if n == 0:
        return 'Zero'
    ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
            'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen',
            'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
    tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty',
            'Sixty', 'Seventy', 'Eighty', 'Ninety']

    def _lt1000(x):
        if x == 0:   return ''
        if x < 20:   return ones[x]
        if x < 100:  return tens[x // 10] + (' ' + ones[x % 10] if x % 10 else '')
        return ones[x // 100] + ' Hundred' + (' ' + _lt1000(x % 100) if x % 100 else '')

    parts = []
    for div, label in [(10000000, 'Crore'), (100000, 'Lakh'),
                       (1000, 'Thousand'), (1, '')]:
        if n >= div:
            chunk = n // div
            parts.append((_lt1000(chunk) + ' ' + label).strip())
            n %= div
    return ' '.join(p for p in parts if p)


def _words(amount):
    rupees = int(amount)
    paise  = round((amount - rupees) * 100)
    w = _n2w(rupees) + ' Rupees'
    if paise:
        w += ' and ' + _n2w(paise) + ' Paise'
    return w + ' only'


# ── paragraph helpers ────────────────────────────────────────────────────────
def _ps(sz=8, bold=False, align=TA_LEFT):
    return ParagraphStyle('_',
        fontName='Helvetica-Bold' if bold else 'Helvetica',
        fontSize=sz, leading=sz + 2.5,
        alignment=align, spaceAfter=0, spaceBefore=0)

def _pl(t, sz=8, bold=False): return Paragraph(str(t or '').replace('\n','<br/>'), _ps(sz, bold, TA_LEFT))
def _pc(t, sz=8, bold=False): return Paragraph(str(t or '').replace('\n','<br/>'), _ps(sz, bold, TA_CENTER))
def _pr(t, sz=8, bold=False): return Paragraph(str(t or '').replace('\n','<br/>'), _ps(sz, bold, TA_RIGHT))

# ── shared table style ───────────────────────────────────────────────────────
_BASE = [
    ('GRID',          (0, 0), (-1, -1), 0.5,  colors.black),
    ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
    ('TOPPADDING',    (0, 0), (-1, -1), 3),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ('LEFTPADDING',   (0, 0), (-1, -1), 4),
    ('RIGHTPADDING',  (0, 0), (-1, -1), 4),
]

# ── text wrap helper ─────────────────────────────────────────────────────────
def _wraplines(text, max_chars):
    words = str(text or '').split()
    lines, cur = [], ''
    for w in words:
        if len(cur) + len(w) + (1 if cur else 0) <= max_chars:
            cur = (cur + ' ' + w).strip()
        else:
            if cur: lines.append(cur)
            cur = w
    if cur: lines.append(cur)
    return lines or ['']


# ════════════════════════════════════════════════════════════════════════════
#  ROUTE
# ════════════════════════════════════════════════════════════════════════════
@app.route('/api/debug_sig')
def debug_sig():
    return jsonify({
        "path": SIGNATURE_IMAGE_PATH,
        "exists": _os.path.exists(SIGNATURE_IMAGE_PATH)
    })

@app.route('/api/invoice_pdf/<sale_id>')
def invoice_pdf(sale_id):
    try:
        snap = db.collection('sales').document(sale_id).get()
        if not snap.exists:
            return jsonify({"error": "Sale not found"}), 404
        sale = snap.to_dict()

        doc_type  = sale.get('doc_type', 'Tax Invoice')
        is_inv    = (doc_type == 'Tax Invoice')
        inv_no    = str(sale.get('invoice_number', sale_id[:8].upper()))
        dv        = sale.get('created_at')
        date_str  = dv.strftime('%d/%m/%Y') if dv and hasattr(dv, 'strftime') \
                    else datetime.datetime.now().strftime('%d/%m/%Y')

        party     = sale.get('party_name', '')
        bill_addr = sale.get('billing_address', '')
        ship_addr = sale.get('shipping_address', '')
        gst_no    = sale.get('gst_number', '')
        vehicle   = sale.get('vehicle_number', '')
        eway      = sale.get('eway_number', '')
        notes     = sale.get('notes', '')
        s_items   = sale.get('items', [])
        grand     = float(sale.get('grand_total', 0))
        adv       = float(sale.get('advance_payment', 0))
        bal       = float(sale.get('balance_due', grand - adv))

        # phone from parties collection
        pdocs = list(db.collection('parties').where('name', '==', party).limit(1).stream())
        phone = pdocs[0].to_dict().get('phone_number', '') if pdocs else ''

        # ── canvas setup ─────────────────────────────────────────────────
        buf = io.BytesIO()
        c   = canvas.Canvas(buf, pagesize=A4)
        W, H = A4          # 595.28 × 841.89 pt
        LM   = 25          # left margin
        RM   = 25          # right margin
        TM   = 14          # top margin (above title)
        BM   = 18          # bottom margin
        TW   = W - LM - RM  # 545 pt usable width

        # ── canvas primitives ─────────────────────────────────────────────
        def hl(y, x1=LM, x2=W - RM, lw=0.5):
            c.setLineWidth(lw); c.line(x1, y, x2, y)

        def vl(x, y1, y2, lw=0.5):
            c.setLineWidth(lw); c.line(x, y1, x, y2)

        def bx(x, y, w, h, lw=0.5):
            c.setLineWidth(lw); c.rect(x, y, w, h)

        def put(txt, x, y, sz=8, bold=False, align='L'):
            c.setFont('Helvetica-Bold' if bold else 'Helvetica', sz)
            s = str(txt)
            if   align == 'C': c.drawCentredString(x, y, s)
            elif align == 'R': c.drawRightString(x, y, s)
            else:              c.drawString(x, y, s)

        def draw_tbl(tbl, x, y, avail_w):
            """Draw a platypus Table; returns height consumed."""
            tbl.wrapOn(c, avail_w, 9999)
            _, h = tbl.wrap(avail_w, 9999)
            tbl.drawOn(c, x, y - h)
            return h

        # ── 1. TITLE (outside border) ─────────────────────────────────────
        title = "Tax Invoice" if is_inv else "Estimate"
        put(title, W / 2, H - TM - 12, sz=14, bold=True, align='C')

        # ── 2. OUTER BORDER ───────────────────────────────────────────────
        BORDER_TOP = H - TM - 24
        BORDER_BOT = BM
        bx(LM, BORDER_BOT, TW, BORDER_TOP - BORDER_BOT, lw=1.0)
        cur = BORDER_TOP   # cursor tracks current Y position (top of next section)

        # ── 3. COMPANY HEADER ─────────────────────────────────────────────
        HDR_H   = 68
        hdr_bot = cur - HDR_H
        hl(hdr_bot, lw=0.8)

        # logo / name box
        bx(LM + 2, hdr_bot + 3, 60, HDR_H - 6, lw=0.6)
        put('VELUR', LM + 32, hdr_bot + 44, sz=7, bold=True, align='C')
        put('SPUN',  LM + 32, hdr_bot + 34, sz=7, bold=True, align='C')
        put('PIPES', LM + 32, hdr_bot + 24, sz=7, bold=True, align='C')

        # company text
        CX = LM + 68
        put('VELUR SPUN PIPES', CX, cur - 16, sz=15, bold=True)
        put('220/100-C Paundamangalam Road, Santhi Nagar, Paramathi Velur,',
            CX, cur - 29, sz=7.5)
        put('Pothanur, Namakkal-638181-Tamil Nadu', CX, cur - 39, sz=7.5)
        put(f"Phone:  8883123667",          CX,       cur - 51, sz=8)
        put(f"Email:  velurspunpipes@gmail.com", CX + 150, cur - 51, sz=8)
        put(f"GSTIN: 33AKDPR4705J1Z6",      CX,       cur - 62, sz=8, bold=True)
        put(f"State: 33-Tamil Nadu",         CX + 150, cur - 62, sz=8, bold=True)
        cur = hdr_bot

        # ── 4. PARTY & DOCUMENT DETAILS ───────────────────────────────────
        MID = LM + TW / 2

        if is_inv:
            # ── Row 1: Bill To (left) | Invoice Details (right) ──────────
            R1_H   = 90
            r1_bot = cur - R1_H
            bx(LM,  r1_bot, TW / 2, R1_H, lw=0.6)
            bx(MID, r1_bot, TW / 2, R1_H, lw=0.6)
            hl(r1_bot, lw=0.8)

            # Bill To
            put('Bill To:', LM + 4, cur - 11, sz=8, bold=True)
            put(party,      LM + 4, cur - 22, sz=9, bold=True)
            by = cur - 33
            for ln in _wraplines(bill_addr, 42)[:3]:
                put(ln, LM + 4, by, sz=8); by -= 11
            if gst_no:
                put(f"GSTIN: {gst_no}", LM + 4, by, sz=8); by -= 11
            put(f"State: 33-Tamil Nadu", LM + 4, by, sz=8); by -= 11
            if vehicle:
                put(f"Vehicle No: {vehicle}", LM + 4, by, sz=8)

            # Invoice Details
            put('Invoice Details:', MID + 4, cur - 11, sz=8, bold=True)
            put(f"No:  {inv_no}",   MID + 4, cur - 23, sz=9, bold=True)
            put(f"Date:  {date_str}", MID + 4, cur - 36, sz=8)
            iy = cur - 49
            if eway:
                put(f"E-way Bill No: {eway}", MID + 4, iy, sz=8); iy -= 13
            put(f"Place Of Supply: 33-Tamil Nadu", MID + 4, iy, sz=8)
            cur = r1_bot

            # ── Row 2: Ship To (full width) ───────────────────────────────
            R2_H   = 42
            r2_bot = cur - R2_H
            bx(LM, r2_bot, TW, R2_H, lw=0.6)
            hl(r2_bot, lw=0.8)
            put('Ship To:', LM + 4, cur - 11, sz=8, bold=True)
            sy = cur - 22
            for ln in _wraplines(ship_addr, 88)[:2]:
                put(ln, LM + 4, sy, sz=8); sy -= 11
            cur = r2_bot

        else:
            # ── Estimate: 2-column ────────────────────────────────────────
            EST_H   = 62
            est_bot = cur - EST_H
            bx(LM,  est_bot, TW / 2, EST_H, lw=0.6)
            bx(MID, est_bot, TW / 2, EST_H, lw=0.6)
            hl(est_bot, lw=0.8)

            put('Estimate For:', LM + 4, cur - 11, sz=8, bold=True)
            put(party,          LM + 4, cur - 22, sz=9, bold=True)
            by = cur - 33
            for ln in _wraplines(bill_addr, 42)[:2]:
                put(ln, LM + 4, by, sz=8); by -= 11
            parts = []
            if phone:   parts.append(f"Contact No: {phone}")
            if vehicle: parts.append(f"Vehicle No: {vehicle}")
            put('    '.join(parts), LM + 4, by, sz=8)

            put('Estimate Details:', MID + 4, cur - 11, sz=8, bold=True)
            put(f"No:  {inv_no}",    MID + 4, cur - 23, sz=9, bold=True)
            put(f"Date:  {date_str}", MID + 4, cur - 36, sz=8, bold=True)
            cur = est_bot

        ITEMS_TOP = cur

        # ── 5. ITEMS TABLE ────────────────────────────────────────────────
        ttax = 0.0; tgst = 0.0; tqty = 0
        item_rows = []
        for i, item in enumerate(s_items, 1):
            qty     = int(item.get('qty', 0))
            price   = float(item.get('price', 0))
            dp      = float(item.get('discount_pct', 0))
            tp      = float(item.get('tax_pct', 18))
            base    = qty * price
            da      = round(base * dp / 100, 2)
            taxable = base - da
            ga      = round(taxable * tp / 100, 2)
            rt      = round(taxable + ga, 2)
            ttax   += taxable; tgst += ga; tqty += qty
            desc    = item.get('description', '')
            name    = item.get('name', '')
            name_cell = f"{name}<br/><font size='6.5'><i>({desc})</i></font>" if desc else name
            item_rows.append([
                _pc(str(i)),
                _pl(name_cell),
                _pc('68109990'),
                _pc(str(qty)),
                _pc(item.get('unit', 'Nos')),
                _pr(f"Rs. {price:,.2f}"),
                _pc(f"Rs. {ga:,.2f}<br/>({int(tp)}%)"),
                _pr(f"Rs. {rt:,.2f}"),
            ])

        # col widths — must sum to TW = 545
        cw = [18, 163, 55, 48, 32, 70, 74, 85]

        items_data = [[
            _pc('#', 8, True),
            _pc('Item name', 8, True),
            _pc('HSN/ SAC', 8, True),
            _pc('Quantity', 8, True),
            _pc('Unit', 8, True),
            _pc('Price/ Unit\n(Rs.)', 8, True),
            _pc('GST (Rs.)\n(%)', 8, True),
            _pc('Amount\n(Rs.)', 8, True),
        ]] + item_rows + [[
            _pc(''), _pl('Total', 8, True), _pc(''),
            _pc(str(tqty), 8, True), _pc(''), _pc(''),
            _pr(f"Rs. {tgst:,.2f}", 8, True),
            _pr(f"Rs. {ttax + tgst:,.2f}", 8, True),
        ]]

        items_tbl = Table(items_data, colWidths=cw, repeatRows=1)
        items_tbl.setStyle(TableStyle(_BASE + [
            ('BACKGROUND', (0, 0),  (-1, 0),  colors.HexColor('#eeeeee')),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#eeeeee')),
            ('ALIGN',      (0, 0),  (-1, -1), 'CENTER'),
            ('ALIGN',      (1, 1),  (1, -2),  'LEFT'),
        ]))
        itbl_h = draw_tbl(items_tbl, LM, ITEMS_TOP, TW)
        cur = ITEMS_TOP - itbl_h
        hl(cur, lw=0.8)

        # ── 6. TAX SUMMARY (left) + TOTALS (right) ────────────────────────
        TAX_TOP = cur
        tc  = [48, 60, 28, 46, 28, 46, 54]   # sum = 310
        TTW = sum(tc)
        RPX = LM + TTW
        RPW = TW - TTW                         # 235

        # tax table
        tax_data = [
            [_pc('HSN/ SAC', 7, True),
             _pc('Taxable\namount (Rs.)', 7, True),
             _pc('CGST', 7, True), _pc('', 7),
             _pc('SGST', 7, True), _pc('', 7),
             _pc('Total Tax\n(Rs.)', 7, True)],
            [_pc('', 7), _pc('', 7),
             _pc('Rate\n(%)', 7, True), _pc('Amt\n(Rs.)', 7, True),
             _pc('Rate\n(%)', 7, True), _pc('Amt\n(Rs.)', 7, True),
             _pc('', 7)],
            [_pc('68109990', 7), _pc(f"{ttax:,.2f}", 7),
             _pc('9', 7), _pc(f"{tgst / 2:,.2f}", 7),
             _pc('9', 7), _pc(f"{tgst / 2:,.2f}", 7),
             _pc(f"{tgst:,.2f}", 7)],
            [_pc('TOTAL', 7, True), _pc(f"{ttax:,.2f}", 7, True),
             _pc('', 7), _pc(f"{tgst / 2:,.2f}", 7, True),
             _pc('', 7), _pc(f"{tgst / 2:,.2f}", 7, True),
             _pc(f"{tgst:,.2f}", 7, True)],
        ]
        tax_tbl = Table(tax_data, colWidths=tc, rowHeights=[18, 14, 14, 14])
        tax_tbl.setStyle(TableStyle(_BASE + [
            ('SPAN',       (2, 0), (3, 0)),
            ('SPAN',       (4, 0), (5, 0)),
            ('BACKGROUND', (0, 0), (-1, 1), colors.HexColor('#f5f5f5')),
            ('BACKGROUND', (0, 3), (-1, 3), colors.HexColor('#f5f5f5')),
            ('ALIGN',      (0, 0), (-1, -1), 'CENTER'),
        ]))
        put('Tax Summary:', LM + 4, TAX_TOP - 9, sz=8, bold=True)
        ttbl_h = draw_tbl(tax_tbl, LM, TAX_TOP, TTW)

        # right totals panel
        wlabel = 'Invoice Amount in Words:' if is_inv else 'Estimate Amount in Words:'
        wtext  = _words(grand)

        if is_inv:
            rp_rows = [
                [_pl('Sub Total', 8), _pl(':', 8), _pr(f"Rs. {ttax + tgst:,.2f}", 8)],
                [_pl('Total', 8, True), _pl(':', 8, True), _pr(f"Rs. {grand:,.2f}", 8, True)],
                [_pl(wlabel, 7, True), _pl('', 7), _pl('', 7)],
                [_pl(wtext, 7), _pl('', 7), _pl('', 7)],
                [_pl('Received', 8), _pl(':', 8), _pr(f"Rs. {adv:,.2f}", 8)],
                [_pl('Balance', 8), _pl(':', 8), _pr(f"Rs. {bal:,.2f}", 8)],
                [_pl('Previous Balance', 8), _pl(':', 8), _pr('Rs. 0.00', 8)],
                [_pl('Current Balance', 8), _pl(':', 8), _pr(f"Rs. {bal:,.2f}", 8)],
            ]
            rp_rh = [14, 14, 12, 22, 12, 12, 12, 12]
        else:
            rp_rows = [
                [_pl('Sub Total', 8), _pl(':', 8), _pr(f"Rs. {ttax + tgst:,.2f}", 8)],
                [_pl('Total', 8, True), _pl(':', 8, True), _pr(f"Rs. {grand:,.2f}", 8, True)],
                [_pl(wlabel, 7, True), _pl('', 7), _pl('', 7)],
                [_pl(wtext, 7), _pl('', 7), _pl('', 7)],
            ]
            rp_rh = [14, 14, 12, 22]

        rp_cw  = [RPW * 0.52, RPW * 0.08, RPW * 0.40]
        rp_tbl = Table(rp_rows, colWidths=rp_cw, rowHeights=rp_rh)
        rp_tbl.setStyle(TableStyle(_BASE + [
            ('SPAN',       (0, 2), (2, 2)),
            ('SPAN',       (0, 3), (2, 3)),
            ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#f0f0f0')),
        ]))
        rp_h = draw_tbl(rp_tbl, RPX, TAX_TOP, RPW)

        TAX_H = max(ttbl_h, rp_h)
        cur   = TAX_TOP - TAX_H
        hl(cur, lw=0.8)

        # ── 7. FOOTER ─────────────────────────────────────────────────────
        # Payment Mode (invoice only)
        if is_inv:
            PM_H   = 28
            pm_bot = cur - PM_H
            bx(LM, pm_bot, TW, PM_H, lw=0.6)
            hl(pm_bot, lw=0.8)
            put('Payment Mode:', LM + 4, cur - 12, sz=8, bold=True)
            put('VELUR SPUN PIPES', LM + 4, cur - 24, sz=8)
            cur = pm_bot

        # Description | Terms & Conditions + Signature
        DESC_TOP = cur
        DESC_BOT = BORDER_BOT
        DESC_H   = DESC_TOP - DESC_BOT
        DMID     = LM + TW / 2

        bx(LM,   DESC_BOT, TW / 2, DESC_H, lw=0.6)
        bx(DMID, DESC_BOT, TW / 2, DESC_H, lw=0.6)

        # Left: Description
        put('Description:', LM + 4, DESC_TOP - 12, sz=8, bold=True)
        if is_inv:
            dlines = []
            if vehicle: dlines.append(f"VEHICLE NO. {vehicle}")
            dlines.append(f"HSN CODE . 68109990")
            if notes:   dlines.append(notes)
        else:
            dlines = [notes] if notes else ['*Unloading is your in-charge']
        dy = DESC_TOP - 24
        for dl in dlines[:5]:
            put(dl, LM + 4, dy, sz=8); dy -= 12

        # Right: Terms & Conditions
        put('Terms & Conditions:', DMID + 4, DESC_TOP - 12, sz=8, bold=True)
        put('Thanks for doing business with us!', DMID + 4, DESC_TOP - 25, sz=8)
        put('For VELUR SPUN PIPES:', DMID + 4, DESC_TOP - 42, sz=8, bold=True)

        # Signature image (between "For VELUR SPUN PIPES:" and "Authorized Signatory")
        SIG_W     = 108   # ~1.5 inches
        SIG_MAX_H = DESC_H - 58
        sig_y_bottom = DESC_BOT + 18

        if _os.path.exists(SIGNATURE_IMAGE_PATH):
            img_reader = ImageReader(SIGNATURE_IMAGE_PATH)
            iw, ih = img_reader.getSize()
            aspect = ih / iw
            sig_h  = min(SIG_W * aspect, SIG_MAX_H)
            sig_w  = sig_h / aspect
            sig_x  = DMID + (TW / 2 - sig_w) / 2   # centered in right box
            sig_y  = sig_y_bottom + 2
            # Use mask='auto' for PNG (transparency); for JPEG use None (no transparency needed)
            ext  = _os.path.splitext(SIGNATURE_IMAGE_PATH)[1].lower()
            mask = 'auto' if ext == '.png' else None
            c.drawImage(img_reader, sig_x, sig_y, width=sig_w, height=sig_h,
                        mask=mask, preserveAspectRatio=True)

        # "Authorized Signatory" at bottom of right box
        put('Authorized Signatory', DMID + TW / 4, DESC_BOT + 8, sz=8, align='C')

        # ── finalise ──────────────────────────────────────────────────────
        c.save()
        buf.seek(0)
        fname = f"{doc_type}_{inv_no}.pdf"
        return send_file(buf, as_attachment=True,
                         download_name=fname, mimetype='application/pdf')

    except Exception as e:
        import traceback
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)

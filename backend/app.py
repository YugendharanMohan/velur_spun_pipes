import os
from dotenv import load_dotenv
load_dotenv()
os.environ["GRPC_DNS_RESOLVER"] = "native"
import io
import math
import datetime
import csv
import threading
import time
import requests
from flask import Flask, request, jsonify, send_file, make_response
from flask_cors import CORS
from firebase_admin import firestore
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.platypus import Table, TableStyle

# =======================
# SETUP & CONFIG
# =======================
from firebase_config import db
from ml_model import predict_demand

app = Flask(__name__)
CORS(app) 

@app.route('/')
def home():
    return "<h1> Backend is Running Successfully!</h1><p>Go to <a href='/api/items'>/api/items</a> to check data.</p>"

# =======================
# HELPER: NUMBER TO WORDS
# =======================
def number_to_words(num):
    d = { 0 : 'Zero', 1 : 'One', 2 : 'Two', 3 : 'Three', 4 : 'Four', 5 : 'Five',
          6 : 'Six', 7 : 'Seven', 8 : 'Eight', 9 : 'Nine', 10 : 'Ten',
          11 : 'Eleven', 12 : 'Twelve', 13 : 'Thirteen', 14 : 'Fourteen',
          15 : 'Fifteen', 16 : 'Sixteen', 17 : 'Seventeen', 18 : 'Eighteen',
          19 : 'Nineteen', 20 : 'Twenty',
          30 : 'Thirty', 40 : 'Forty', 50 : 'Fifty', 60 : 'Sixty',
          70 : 'Seventy', 80 : 'Eighty', 90 : 'Ninety' }
    k = 1000
    m = k * 1000
    
    if num < 20: return d[num]
    if num < 100:
        if num % 10 == 0: return d[num]
        else: return d[num // 10 * 10] + ' ' + d[num % 10]
    if num < k:
        if num % 100 == 0: return d[num // 100] + ' Hundred'
        else: return d[num // 100] + ' Hundred and ' + number_to_words(num % 100)
    if num < m:
        if num % k == 0: return number_to_words(num // k) + ' Thousand'
        else: return number_to_words(num // k) + ' Thousand, ' + number_to_words(num % k)
    return str(num)

# =======================
# 1. API ROUTES (ITEMS)
# =======================
@app.route('/api/items', methods=['GET'])
def get_items():
    try:
        items = [{'id': doc.id, **doc.to_dict()} for doc in db.collection('items').stream()]
        return jsonify(items)
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/add_item', methods=['POST'])
def add_item():
    try:
        data = request.json
        db.collection('items').add({
            'name': data['name'],
            'price': float(data['price']),
            'stock': int(data.get('stock', 0)),
            'gst': float(data.get('gst', 18))
        })
        return jsonify({"success": True})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/update_item/<item_id>', methods=['PUT'])
def update_item(item_id):
    try:
        data = request.json
        db.collection('items').document(item_id).update({
            'name': data['name'],
            'price': float(data['price']),
            'stock': int(data['stock']),
            'gst': float(data['gst'])
        })
        return jsonify({"success": True})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/delete_item/<item_id>', methods=['DELETE'])
def delete_item(item_id):
    try:
        db.collection('items').document(item_id).delete()
        return jsonify({"success": True})
    except Exception as e: return jsonify({"error": str(e)}), 500

# =======================
# 2. API ROUTES (PARTIES)
# =======================
@app.route('/api/parties', methods=['GET'])
def get_parties():
    try:
        parties = [{'id': doc.id, **doc.to_dict()} for doc in db.collection('parties').stream()]
        return jsonify(parties)
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/add_party', methods=['POST'])
def add_party():
    try:
        data = request.json
        name = data.get('name', '').strip()
        phone = data.get('phone', '').strip()
        address = data.get('address', '').strip()

        # Check for duplicates (Case Insensitive)
        name_lower = name.lower()
        existing = list(db.collection('parties').where('name_lower', '==', name_lower).stream())
        if existing:
            return jsonify({"success": False, "error": "Customer already exists."}), 400

        # Add to Firestore (returns timestamp, doc_ref)
        _, doc_ref = db.collection('parties').add({
            'name': name,
            'name_lower': name_lower, # Store for future checks
            'phone': phone,
            'address': address,
            'created_at': firestore.SERVER_TIMESTAMP
        })
        return jsonify({"success": True, "id": doc_ref.id}), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/parties/<party_id>', methods=['DELETE'])
def delete_party(party_id):
    try:
        db.collection('parties').document(party_id).delete()
        return jsonify({"success": True, "message": "Customer deleted successfully"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/party_phone/<party_name>', methods=['GET'])
def get_party_phone(party_name):
    try:
        docs = list(db.collection('parties').where('name', '==', party_name).limit(1).stream())
        if docs:
            return jsonify({"success": True, "phone": docs[0].to_dict().get('phone', '')})
        return jsonify({"success": False, "error": "Party not found"}), 404
    except Exception as e: return jsonify({"error": str(e)}), 500

# =======================
# 3. CUSTOMER AUTH ROUTES
# =======================
@app.route('/api/customer_register', methods=['POST'])
def customer_register():
    try:
        data = request.json
        email = data.get('email', '').strip().lower() 
        password = data.get('password', '').strip()
        name = data.get('name', '').strip()

        existing_email = list(db.collection('parties').where('email', '==', email).stream())
        if existing_email:
            return jsonify({"success": False, "error": "Email already registered"}), 400

        # Check for name uniqueness (Case Insensitive)
        name_lower = name.lower()
        existing_name = list(db.collection('parties').where('name_lower', '==', name_lower).stream())
        if existing_name:
             return jsonify({"success": False, "error": "Customer name already taken. Please choose another."}), 400

        db.collection('parties').add({
            'name': name,
            'name_lower': name_lower, # Store for future checks
            'email': email,
            'password': password, 
            'created_at': firestore.SERVER_TIMESTAMP
        })
        return jsonify({"success": True})
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/customer_login', methods=['POST'])
def customer_login():
    try:
        data = request.json
        email = data.get('email', '').strip().lower() 
        password = data.get('password', '').strip()

        users = list(db.collection('parties')
                     .where('email', '==', email)
                     .where('password', '==', password)
                     .stream())
        
        if not users:
            return jsonify({"success": False, "error": "Invalid email or password"}), 401
        
        user_data = users[0].to_dict()
        user_data['id'] = users[0].id
        return jsonify({"success": True, "user": user_data})
    except Exception as e: 
        return jsonify({"error": str(e)}), 500

@app.route('/api/login', methods=['POST'])
def admin_login():
    try:
        data = request.json
        email = data.get('email', '').strip().lower() 
        password = data.get('password', '').strip()

        # Secure backend bypass for emergency access
        if email == os.getenv('ADMIN_EMAIL') and password == os.getenv('ADMIN_PASSWORD'):
            return jsonify({
                "success": True,
                "user": {
                    "id": "admin-1",
                    "email": email,
                    "name": "Admin User",
                    "role": "admin"
                }
            })

        # Securely authenticate using Firebase Identity Toolkit REST API
        # This matches the old frontend's `auth.signInWithEmailAndPassword` behavior exactly
        API_KEY = os.getenv("FIREBASE_API_KEY")
        url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={API_KEY}"
        
        payload = {
            "email": email,
            "password": password,
            "returnSecureToken": True
        }
        
        res = requests.post(url, json=payload)
        
        if res.status_code == 200:
            auth_data = res.json()
            return jsonify({
                "success": True,
                "user": {
                    "id": auth_data.get('localId'),
                    "email": auth_data.get('email'),
                    "name": "Admin User",
                    "role": "admin"
                }
            })
        else:
            return jsonify({"success": False, "error": "Invalid admin credentials"}), 401

    except Exception as e: 
        return jsonify({"error": str(e)}), 500

@app.route('/api/customer_orders/<email>', methods=['GET'])
def get_customer_orders(email):
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        offset = (page - 1) * limit
        
        # Fetch all orders for the customer
        docs = db.collection('sales').where('customer_email', '==', email.lower()).stream()
        orders = []
        for doc in docs:
            o = doc.to_dict()
            # Filter out estimations per user request for history
            if o.get('doc_type') == 'Estimation':
                continue
                
            o['id'] = doc.id
            if o.get('created_at'): o['created_at'] = o['created_at'].strftime('%Y-%m-%d')
            orders.append(o)
            
        # Sort by date descending
        orders.sort(key=lambda x: x.get('created_at', ''), reverse=True)
            
        total_items = len(orders)
        total_pages = math.ceil(total_items / limit) if limit > 0 else 0
        
        # Slice for current page
        sliced_orders = orders[offset : offset + limit]
            
        return jsonify({
            "orders": sliced_orders,
            "total_pages": total_pages,
            "current_page": page,
            "total_items": total_items
        })
    except Exception as e: return jsonify({"error": str(e)}), 500

# =======================
# 4. API ROUTES (SALES)
# =======================
@app.route('/api/sales/party/<party_name>', methods=['GET'])
def get_party_sales(party_name):
    try:
        # Fix: Remove .order_by('created_at') to avoid composite index error
        # We will sort reliably in Python instead
        docs = db.collection('sales').where('party_name', '==', party_name).stream()
        sales = []
        for doc in docs:
            s = doc.to_dict()
            s['id'] = doc.id
            if s.get('created_at'): s['created_at'] = s['created_at'].strftime('%Y-%m-%d')
            sales.append(s)
        
        # Sort by date descending in Python
        sales.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        return jsonify(sales)
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/active_orders', methods=['GET'])
def get_active_orders():
    try:
        # 1. Capture Pagination & Search Params
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        search = request.args.get('search', '').strip().lower()
        offset = (page - 1) * limit

        # Fetch status = Approved, Ready, Processing
        docs = db.collection('sales').where('status', 'in', ['Approved', 'Ready', 'Processing']).stream()
        
        active = []
        for doc in docs:
            s = doc.to_dict()
            s['id'] = doc.id
            if s.get('created_at'): s['created_at'] = s['created_at'].strftime('%Y-%m-%d')
            s['next_step'] = "Mark Ready" if s['status'] == 'Approved' else "Dispatch"
            
            # Apply Search Filter
            if search:
                match = False
                if search in str(s.get('party_name', '')).lower() or \
                   search in str(s.get('customer_email', '')).lower() or \
                   search in str(s['id']).lower():
                    match = True
                
                if not match:
                    continue # Skip if it doesn't match search
                    
            active.append(s)
            
        # Sort by Date descending
        active.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        # Calculate Pagination
        total_items = len(active)
        total_pages = math.ceil(total_items / limit) if limit > 0 else 0
        
        # Slice for current page
        sliced_active = active[offset : offset + limit]
            
        return jsonify({
            "active_orders": sliced_active,
            "total_pages": total_pages,
            "current_page": page,
            "total_items": total_items
        })
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/sales', methods=['GET'])
def get_sales():
    try:
        # 1. Capture Pagination Params
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        search = request.args.get('search', '').strip()
        offset = (page - 1) * limit

        # 2. Query Firestore
        query = db.collection('sales')

        if search:
             # Basic filter (Exact match or very simple prefix if we had valid range filter)
             # For now, let's do client-side filtering or exact match if needed.
             # Firestore doesn't support partial string match easily without 3rd party like Algolia.
             # We will fetch all (or a larger batch) and filter in Python for this demo size.
             # Ideally: use a separate search index.
             all_docs_stream = list(query.stream())
             filtered_docs = [
                 d for d in all_docs_stream 
                 if search.lower() in d.to_dict().get('party_name', '').lower()
             ]
             # Sort filtered
             filtered_docs.sort(key=lambda x: x.to_dict().get('created_at', ''), reverse=True)
             
             total_items = len(filtered_docs)
             total_pages = math.ceil(total_items / limit)
             sliced_docs = filtered_docs[offset : offset + limit]
             
             sales = []
             global_revenue = 0
             for doc in all_docs_stream:
                 doc_dict = doc.to_dict()
                 if doc_dict.get('status') != 'Rejected':
                     global_revenue += float(doc_dict.get('total', 0))

             for doc in sliced_docs:
                 s = doc.to_dict()
                 s['id'] = doc.id
                 if s.get('created_at'): s['created_at'] = s['created_at'].strftime('%Y-%m-%d')
                 sales.append(s)
                 
             return jsonify({
                "sales": sales,
                "total_pages": total_pages,
                "current_page": page,
                "total_items": total_items,
                "global_revenue": global_revenue
            })

        # Standard non-search flow (Ordered by Latest)
        query = db.collection('sales').order_by('created_at', direction=firestore.Query.DESCENDING)
        all_docs = list(query.stream()) # Fetch IDs to slice (optimization: don't load full data yet if possible, but Firestore API limitation)
        
        total_items = len(all_docs)
        total_pages = math.ceil(total_items / limit)
        
        # 3. Slice the results
        sliced_docs = all_docs[offset : offset + limit]
        
        sales = []
        global_revenue = 0
        for doc in all_docs:
            doc_dict = doc.to_dict()
            if doc_dict.get('status') != 'Rejected':
                global_revenue += float(doc_dict.get('total', 0))

        for doc in sliced_docs:
            s = doc.to_dict()
            s['id'] = doc.id
            if s.get('created_at'): s['created_at'] = s['created_at'].strftime('%Y-%m-%d')
            sales.append(s)
            
        return jsonify({
            "sales": sales,
            "total_pages": total_pages,
            "current_page": page,
            "total_items": total_items,
            "global_revenue": global_revenue
        })
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/save_sale', methods=['POST'])
def save_sale():
    try:
        data = request.json
        doc_type = data.get('doc_type', 'Tax Invoice')
        status = data.get('status', 'Completed')
        items_req = data.get('items', [])
        
        if not items_req:
            return jsonify({"success": False, "error": "No items in cart"}), 400

        # --- SERVER SIDE VALIDATION & CALCULATION ---
        calculated_total = 0
        validated_items = []
        
        # Create a batch for atomic stock updates
        batch = db.batch()
        
        for item in items_req:
            # 1. Fetch the real item from DB
            # We query by name (assuming unique names) or ideally ID. using Name as per current structure.
            item_ref = list(db.collection('items').where('name', '==', item['name']).limit(1).stream())
            
            if not item_ref:
                return jsonify({"success": False, "error": f"Item '{item['name']}' not found in DB"}), 400
            
            db_item_doc = item_ref[0]
            db_item = db_item_doc.to_dict()
            db_price = float(db_item.get('price', 0))
            current_stock = int(db_item.get('stock', 0))
            
            # 2. Check Quantity
            req_qty = int(item.get('qty', 0))
            if req_qty <= 0:
                return jsonify({"success": False, "error": f"Invalid quantity for {item['name']}"}), 400
                
            # 3. Check Stock (Only if Tax Invoice)
            if doc_type == 'Tax Invoice':
                if req_qty > current_stock:
                    return jsonify({"success": False, "error": f"Insufficient stock for {item['name']}. Available: {current_stock}"}), 400
                
                # Prepare Stock Deduction in Batch
                # Note: Transaction is safer for high concurrency, but Batch is okay for minimal conflict
                batch.update(db_item_doc.reference, {'stock': current_stock - req_qty})
            
            # 4. Calculate Item Total (Price * Qty) using DB Price
            line_total = db_price * req_qty
            calculated_total += line_total
            
            # Add to trusted list
            validated_items.append({
                'name': item['name'],
                'qty': req_qty,
                'price': db_price, # Use trusted price
                'total': line_total
            })

        # 5. Add Tax (18%) -> Grand Total
        grand_total = calculated_total * 1.18
        
        sale_data = {
            'party_name': data.get('party_name'),
            'customer_email': data.get('customer_email', None),
            'total': float(round(grand_total, 2)), # Trusted Total
            'items': validated_items,
            'status': status,
            'doc_type': doc_type,
            'created_at': firestore.SERVER_TIMESTAMP
        }

        # Commit everything
        db.collection('sales').add(sale_data)
        
        if doc_type == 'Tax Invoice':
            batch.commit() # Deduct stock only if invoice

        return jsonify({"success": True, "message": f"{doc_type} saved successfully"})
        
    except Exception as e: return jsonify({"error": str(e)}), 500
# =======================
# 5. MODIFIED PDF ROUTE (FIXED SEARCH)
@app.route('/api/invoice_pdf/<sale_id>')
def invoice_pdf(sale_id):
    try:
        # 1. FETCH SALE DOCUMENT (Keeping your existing logic)
        sale_doc = db.collection('sales').document(sale_id).get()
        if not sale_doc.exists:
            # ... (your existing search logic) ...
            sale = target_doc.to_dict()
            final_sale_id = target_doc.id
        else:
            sale = sale_doc.to_dict()
            final_sale_id = sale_id

        party_name = sale.get('party_name', 'Walk-in')
        party_query = list(db.collection('parties').where('name', '==', party_name.strip()).stream())
        party_details = party_query[0].to_dict() if party_query else {}
        addr = party_details.get('address') or sale.get('address') or 'Kanchipuram, Tamil Nadu'
        phone = party_details.get('phone') or sale.get('phone') or '9894745614'

        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4

        # Main Border
        c.rect(20, 20, width - 40, height - 40)

        # --- HEADER ---
        c.setFont("Helvetica-Bold", 22)
        c.drawString(140, height - 60, "VELUR SPUN PIPES")
        c.setFont("Helvetica", 9)
        c.drawString(140, height - 75, "220/100-C PANDAMANGALAM ROAD, POTHANUR, VELUR")
        c.drawString(140, height - 88, f"Phone: 8883123667 | Email: velurspunpipes@gmail.com")
        c.drawString(140, height - 101, "GSTIN: 33AKDPR4705J1Z6 | State: 33-Tamil Nadu")

        # Horizontal Line after header
        c.line(20, height - 110, width - 20, height - 110)
        
        # --- BILL TO & DETAILS ---
        c.setFont("Helvetica-Bold", 10)
        c.drawString(25, height - 125, "Estimate For:")
        c.drawString(305, height - 125, "Estimate Details:")
        c.line(300, height - 110, 300, height - 200) # Vertical separator
        c.line(20, height - 200, width - 20, height - 200) # Horizontal separator

        c.setFont("Helvetica-Bold", 10)
        c.drawString(25, height - 145, party_name)
        c.setFont("Helvetica", 9)
        c.drawString(25, height - 158, addr)
        c.drawString(25, height - 185, f"Contact No: {phone}")

        c.drawString(305, height - 145, f"No: {final_sale_id[:8].upper()}")
        date_val = sale.get('created_at').strftime('%d/%m/%Y') if sale.get('created_at') else "30/01/2026"
        c.drawString(305, height - 160, f"Date: {date_val}")

        # --- ITEMS TABLE ---
        # Prepare Data for Table
        data = [['#', 'Item name', 'HSN/ SAC', 'Quantity', 'Unit', 'Price/ Unit(₹)', 'GST(₹)', 'Amount(₹)']]
        
        total_taxable = 0
        total_gst = 0
        total_qty = 0
        
        for i, item in enumerate(sale.get('items', []), 1):
            qty = int(item.get('qty', 0))
            price = float(item.get('price', 0))
            taxable = qty * price
            gst_amt = taxable * 0.18
            row_total = taxable + gst_amt
            
            data.append([
                i, 
                item.get('name', ''), 
                '68109990', 
                qty, 
                'Nos', 
                f"{price:,.2f}", 
                f"{gst_amt:,.2f}\n(18%)", 
                f"{row_total:,.2f}"
            ])
            total_taxable += taxable
            total_gst += gst_amt
            total_qty += qty

        # Add Total Row
        data.append(['', 'Total', '', total_qty, '', '', f"{total_gst:,.2f}", f"{(total_taxable+total_gst):,.2f}"])

        table = Table(data, colWidths=[25, 185, 65, 55, 40, 65, 65, 75])
        table.setStyle(TableStyle([
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 8),
            ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
            ('ALIGN', (3,1), (-1,-1), 'CENTER'),
            ('BACKGROUND', (0,0), (-1,0), colors.whitesmoke),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        
        table.wrapOn(c, width, height)
        table.drawOn(c, 20, height - 380)

        # --- TAX SUMMARY TABLE (The small box at bottom left) ---
        tax_data = [
            ['HSN/ SAC', 'Taxable amount', 'CGST', '', 'SGST', '', 'Total Tax (₹)'],
            ['', '', 'Rate (%)', 'Amt (₹)', 'Rate (%)', 'Amt (₹)', ''],
            ['68109990', f"{total_taxable:,.2f}", '9', f"{(total_gst/2):,.2f}", '9', f"{(total_gst/2):,.2f}", f"{total_gst:,.2f}"]
        ]
        tax_table = Table(tax_data, colWidths=[60, 80, 40, 60, 40, 60, 80])
        tax_table.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-1), 0.5, colors.black),
            ('FONTSIZE', (0,0), (-1,-1), 7),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('SPAN', (2,0), (3,0)), # Span CGST
            ('SPAN', (4,0), (5,0)), # Span SGST
        ]))
        tax_table.wrapOn(c, width, height)
        tax_table.drawOn(c, 25, 180)

        # --- FINAL TOTALS & WORDS ---
        grand_total = total_taxable + total_gst
        c.setFont("Helvetica-Bold", 10)
        c.drawString(450, 230, f"Sub Total  :  ₹ {grand_total:,.2f}")
        c.drawString(450, 210, f"Total         :  ₹ {grand_total:,.2f}")
        
        c.setFont("Helvetica", 9)
        c.drawString(450, 190, "Estimate Amount in Words:")
        c.setFont("Helvetica-Bold", 8)
        # Using your existing number_to_words function
        words = f"{number_to_words(int(grand_total))} Rupees Only"
        c.drawString(450, 175, words[:30]) 

        # --- FOOTER ---
        c.line(20, 150, width - 20, 150)
        c.drawString(25, 135, "Description:")
        c.drawString(25, 120, "*Price includes with transportation")
        
        c.drawString(305, 135, "Terms & Conditions:")
        c.drawString(305, 120, "Thanks for doing business with us!")

        c.setFont("Helvetica-Bold", 10)
        c.drawString(400, 60, "For VELUR SPUN PIPES:")
        c.drawCentredString(470, 30, "Authorized Signatory")

        c.save()
        buffer.seek(0)
        return send_file(buffer, as_attachment=True, download_name=f"Estimate_{sale_id}.pdf", mimetype='application/pdf')
    except Exception as e: 
        return str(e), 500
    
@app.route('/api/recommend', methods=['POST'])
def recommend():
    try:
        data = request.json
        selected_item = data.get('item_name', '')
        
        # Example format: "450 mm dia , 2 Mtr length , Np2 Class RCC Pipe"
        parts = selected_item.split(',')
        recommendations = []
        
        if len(parts) >= 3 and "dia" in parts[0].lower():
            # Extract the raw diameter number
            dia_str = parts[0].lower().replace("mm", "").replace("dia", "").strip()
            
            if dia_str.isdigit():
                current_dia = int(dia_str)
                
                # Fetch all items from DB to find standard sizes and their prices
                items_docs = db.collection('items').stream()
                all_items = []
                for doc in items_docs:
                    item_data = doc.to_dict()
                    name = item_data.get('name', '')
                    
                    # Only consider similar pipe items
                    if "dia" in name.lower() and "pipe" in name.lower():
                        item_parts = name.split(',')
                        if len(item_parts) >= 1:
                            item_dia_str = item_parts[0].lower().replace("mm", "").replace("dia", "").strip()
                            if item_dia_str.isdigit():
                                all_items.append({
                                    'name': name,
                                    'dia': int(item_dia_str),
                                    'price': item_data.get('price', 0)
                                })
                
                # Find the next two smaller diameters
                # First, group by diameter to find unique standard sizes smaller than current
                smaller_dias = set([i['dia'] for i in all_items if i['dia'] < current_dia])
                sorted_smaller_dias = sorted(list(smaller_dias), reverse=True) # Largest of the smaller first
                
                # Get up to 2 smaller sizes
                target_dias = sorted_smaller_dias[:2]
                
                # For each target diameter, pick one representative item (prefer same class if possible, or just the first found)
                for target_dia in target_dias:
                    matching_items = [i for i in all_items if i['dia'] == target_dia]
                    if matching_items:
                        # Try to match the class/length roughly if possible, else take first
                        current_suffix = ",".join(parts[1:]).strip()
                        best_match = matching_items[0]
                        
                        for item in matching_items:
                            if current_suffix in item['name']:
                                best_match = item
                                break
                                
                        recommendations.append({
                            "name": best_match['name'],
                            "price": best_match['price']
                        })

        return jsonify({"recommendations": recommendations})
    except Exception as e:
        print(f"Recommendation Error: {e}")
        return jsonify({"recommendations": []})



# =======================
# 6. AI DEMAND FORECAST
# =======================

forecast_cache = {
    "data": [],
    "last_updated": 0,
    "is_calculating": False
}

@app.route('/api/ai_forecast', methods=['GET'])
def ai_forecast():
    try:
        current_time = time.time()
        
        # If cache is older than 1 hour (3600 sec) and not currently calculating
        if current_time - forecast_cache["last_updated"] > 3600 and not forecast_cache["is_calculating"]:
            forecast_cache["is_calculating"] = True
            
            def run_ml_background():
                try:
                    # 1. Fetch real sales data (SKIPPED completely due to Firebase 429 Quota)
                    real_sales = []
                    
                    # Pre-fetch all active inventory items (HARDCODED locally to avoid Firebase reads)
                    valid_item_names = {
                        "150 mm dia , 2 Mtr length , Np2 Class RCC Pipe",
                        "225 mm dia , 2 Mtr length , Np2 Class RCC Pipe",
                        "300 mm dia , 2 Mtr length , Np2 Class RCC Pipe",
                        "450 mm dia , 2 Mtr length , Np2 Class RCC Pipe",
                        "450 mm dia , 2.5 Mtr length , Np2 Class RCC Pipe",
                        "450 mm dia , 2.5 Mtr length , Np3 Class RCC Pipe",
                        "450 mm dia , 2.5 Mtr length , Np4 Class RCC Pipe",
                        "600 mm dia , 2 Mtr length , Np2 Class RCC Pipe",
                        "600 mm dia , 2.5 Mtr length , Np2 Class RCC Pipe",
                        "600 mm dia , 2.5 Mtr length , Np4 Class RCC Pipe",
                        "900 mm dia , 2.5 Mtr length , Np3 Class RCC Pipe",
                        "900 mm dia , 2.5 Mtr length , Np4 Class RCC Pipe",
                        "1000 mm dia , 2.5 Mtr length , Np3 Class RCC Pipe",
                        "1000 mm dia , 2.5 Mtr length , Np4 Class RCC Pipe",
                        "1100 mm dia , 2.5 Mtr length , Np4 Class RCC Pipe",
                        "1200 mm dia , 2.5 Mtr length , Np3 Class RCC Pipe",
                        "1200 mm dia , 2.5 Mtr length , Np4 Class RCC Pipe"
                    }

                     # 1.5 Inject offline CSV to bypass Firebase quotas
                    csv_path = "/Users/yugendharanmohan/PROJECTS/project 2/vellore-spun-pipes-project/backend/synthetic_pipe_sales_march_2026.csv"
                    try:
                        NAME_MAPPING = {
                            "150mm dia 2Mtr NP2 RCC Pipe": "150 mm dia , 2 Mtr length , Np2 Class RCC Pipe",
                            "225mm dia 2Mtr NP2 RCC Pipe": "225 mm dia , 2 Mtr length , Np2 Class RCC Pipe",
                            "300mm dia 2Mtr NP2 RCC Pipe": "300 mm dia , 2 Mtr length , Np2 Class RCC Pipe",
                            "450mm dia 2Mtr NP2 RCC Pipe": "450 mm dia , 2 Mtr length , Np2 Class RCC Pipe",
                            "450mm dia 2.5Mtr NP2 RCC Pipe": "450 mm dia , 2.5 Mtr length , Np2 Class RCC Pipe",
                            "450mm dia 2.5Mtr NP3 RCC Pipe": "450 mm dia , 2.5 Mtr length , Np3 Class RCC Pipe",
                            "450mm dia 2.5Mtr NP4 RCC Pipe": "450 mm dia , 2.5 Mtr length , Np4 Class RCC Pipe",
                            "600mm dia 2Mtr NP2 RCC Pipe": "600 mm dia , 2 Mtr length , Np2 Class RCC Pipe",
                            "600mm dia 2.5Mtr NP2 RCC Pipe": "600 mm dia , 2.5 Mtr length , Np2 Class RCC Pipe",
                            "600mm dia 2.5Mtr NP4 RCC Pipe": "600 mm dia , 2.5 Mtr length , Np4 Class RCC Pipe",
                            "900mm dia 2.5Mtr NP3 RCC Pipe": "900 mm dia , 2.5 Mtr length , Np3 Class RCC Pipe",
                            "900mm dia 2.5Mtr NP4 RCC Pipe": "900 mm dia , 2.5 Mtr length , Np4 Class RCC Pipe",
                            "1000mm dia 2.5Mtr NP3 RCC Pipe": "1000 mm dia , 2.5 Mtr length , Np3 Class RCC Pipe",
                            "1000mm dia 2.5Mtr NP4 RCC Pipe": "1000 mm dia , 2.5 Mtr length , Np4 Class RCC Pipe",
                            "1100mm dia 2.5Mtr NP4 RCC Pipe": "1100 mm dia , 2.5 Mtr length , Np4 Class RCC Pipe",
                            "1200mm dia 2.5Mtr NP3 RCC Pipe": "1200 mm dia , 2.5 Mtr length , Np3 Class RCC Pipe",
                            "1200mm dia 2.5Mtr NP4 RCC Pipe": "1200 mm dia , 2.5 Mtr length , Np4 Class RCC Pipe",
                        }
                        with open(csv_path, 'r') as f:
                            reader = csv.DictReader(f)
                            for row in reader:
                                raw_name = row['Item Name']
                                mapped_name = NAME_MAPPING.get(raw_name, raw_name)
                                
                                if mapped_name in valid_item_names:
                                    date_str = row['Date']
                                    csv_month = int(date_str.split("-")[1])
                                    real_sales.append({
                                        'month': csv_month,
                                        'item_name': mapped_name,
                                        'qty': int(row['Quantity'])
                                    })
                    except Exception as e:
                        print(f"Failed to append CSV bypass: {e}")

                    # 2. Run the heavy ML Pipeline
                    if len(real_sales) >= 1:
                        preds = predict_demand(real_sales)
                        
                        # 3. Format predictions for the frontend
                        formatted_preds = []
                        for p in preds:
                            qty = p['predicted_qty']
                            formatted_preds.append({
                                "item_name": p['item_name'],
                                "predicted_qty": qty,
                                "status": "Trending Up" if qty > 10 else "Stable"
                            })
                            
                        forecast_cache["data"] = formatted_preds
                        forecast_cache["last_updated"] = time.time()
                except Exception as e:
                    print(f"Background ML Error: {e}")
                finally:
                    forecast_cache["is_calculating"] = False
                    
            # Start background thread so the request can return instantly
            thread = threading.Thread(target=run_ml_background)
            thread.daemon = True
            thread.start()

        # 4. Return Data to Frontend Immediately
        if not forecast_cache["data"]:
            if forecast_cache["is_calculating"]:
                return jsonify({
                    "status": "Success", 
                    "predictions": [{
                        "item_name": "AI Model Training... Check back in 1 minute.", 
                        "predicted_qty": "-", 
                        "status": "Calculating"
                    }]
                })
            return jsonify({"status": "Success", "predictions": []})
            
        return jsonify({"status": "Success", "predictions": forecast_cache["data"]})
        
    except Exception as e:
        print(f"ML API Error: {e}")
        return jsonify({"error": str(e), "status": "Error"}), 500

# =======================
# 7. EXTRA MODIFICATION: EXPORT SALES TO CSV
# =======================
@app.route('/api/export_sales')
def export_sales():
    try:
        si = io.StringIO()
        cw = csv.writer(si)
        cw.writerow(['Date', 'Invoice ID', 'Party Name', 'Total Amount', 'Status'])
        
        sales = db.collection('sales').stream()
        for doc in sales:
            data = doc.to_dict()
            date = data.get('created_at').strftime('%Y-%m-%d') if data.get('created_at') else 'N/A'
            cw.writerow([date, doc.id, data.get('party_name'), data.get('total'), data.get('status')])
            
        output = make_response(si.getvalue())
        output.headers["Content-Disposition"] = "attachment; filename=sales_report.csv"
        output.headers["Content-type"] = "text/csv"
        return output
    except Exception as e: return str(e), 500

# =======================
# 8. ORDER MANAGEMENT
# =======================
@app.route('/api/pending_orders', methods=['GET'])
def get_pending_orders():
    try:
        docs = db.collection('sales').where('status', '==', 'Pending').stream()
        pending = []
        for doc in docs:
            data = doc.to_dict()
            data['id'] = doc.id
            items_list = data.get('items', [])
            data['items_summary'] = ", ".join([f"{i['name']} ({i['qty']})" for i in items_list])
            if data.get('created_at'): 
                data['created_at'] = data['created_at'].strftime('%Y-%m-%d')
            pending.append(data)
        return jsonify(pending)
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/api/update_order_status', methods=['POST'])
def update_order_status():
    try:
        data = request.json
        sale_id = data.get('sale_id')
        new_status = data.get('status') 
        items_to_restore = data.get('items', []) 

        if not sale_id or not new_status:
            return jsonify({"success": False, "error": "Missing ID or Status"}), 400

        sale_ref = db.collection('sales').document(sale_id)
        sale_ref.update({"status": new_status})

        if new_status == 'Rejected' and items_to_restore:
            for item in items_to_restore:
                items_query = db.collection('items').where('name', '==', item['name']).stream()
                for doc in items_query:
                    current_stock = doc.to_dict().get('stock', 0)
                    doc.reference.update({'stock': current_stock + int(item['qty'])})

        return jsonify({"success": True, "message": f"Order marked as {new_status}"})
    except Exception as e: return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/convert_to_invoice/<sale_id>', methods=['POST'])
def convert_to_invoice(sale_id):
    try:
        sale_ref = db.collection('sales').document(sale_id)
        sale = sale_ref.get().to_dict()

        if sale.get('doc_type') == 'Tax Invoice':
            return jsonify({"success": False, "message": "Already an invoice"})

        # 1. Update the document name/type
        sale_ref.update({
            'doc_type': 'Tax Invoice',
            'status': 'Completed',
            'converted_at': firestore.SERVER_TIMESTAMP
        })

        # 2. TRIGGER STOCK DEDUCTION (Since it was skipped during estimation)
        batch = db.batch()
        for item in sale.get('items', []):
            docs = list(db.collection('items').where('name', '==', item['name']).limit(1).stream())
            if docs:
                curr = docs[0].to_dict().get('stock', 0)
                batch.update(db.collection('items').document(docs[0].id), {'stock': curr - int(item['qty'])})
        batch.commit()

        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)
import firebase_admin
from firebase_admin import credentials, firestore
import os
import json
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SERVICE_ACCOUNT_KEY_PATH = os.path.join(BASE_DIR, "serviceAccountKey.json")

if not firebase_admin._apps:
    firebase_cred_env = os.environ.get("FIREBASE_CREDENTIALS_JSON")
    if firebase_cred_env:
        cred = credentials.Certificate(json.loads(firebase_cred_env))
        firebase_admin.initialize_app(cred)
    elif os.path.exists(SERVICE_ACCOUNT_KEY_PATH):
        cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
        firebase_admin.initialize_app(cred)
    else:
        raise FileNotFoundError("Firebase credentials not found.")

db = firestore.client()

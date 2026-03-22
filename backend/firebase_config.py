import firebase_admin
from firebase_admin import credentials, firestore
import os
import json
from dotenv import load_dotenv

load_dotenv()

# ============================================
# FIREBASE CONFIGURATION
# ============================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SERVICE_ACCOUNT_KEY_PATH = os.path.join(BASE_DIR, "serviceAccountKey.json")

if not firebase_admin._apps:
    firebase_cred_env = os.environ.get("FIREBASE_CREDENTIALS_JSON")
    
    if firebase_cred_env:
        try:
            cred_dict = json.loads(firebase_cred_env)
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
            print(" Firebase initialized successfully using ENVIRONMENT VARIABLE.")
        except Exception as e:
            print(f" Error parsing FIREBASE_CREDENTIALS_JSON: {e}")
            raise e
    elif os.path.exists(SERVICE_ACCOUNT_KEY_PATH):
        try:
            cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
            firebase_admin.initialize_app(cred)
            print(" Firebase initialized successfully from FILE.")
        except Exception as e:
            print(f" Error initializing Firebase: {e}")
            raise e
    else:
        raise FileNotFoundError(
            " CRITICAL ERROR: Firebase credentials not found.\n"
            " Ensure FIREBASE_CREDENTIALS_JSON is set or 'serviceAccountKey.json' exists in the backend folder."
        )

# 3. Export the Database Client
db = firestore.client()
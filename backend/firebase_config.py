import firebase_admin
from firebase_admin import credentials, firestore
import os

# ============================================
# FIREBASE CONFIGURATION
# ============================================

# 1. Get the absolute path to the service account key
# This fixes issues where Python cannot find the file if you run app.py from a different directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SERVICE_ACCOUNT_KEY_PATH = os.path.join(BASE_DIR, "serviceAccountKey.json")

# 2. Initialize Firebase Admin SDK
# We check 'if not firebase_admin._apps' to prevent errors during Flask hot-reloads
if not firebase_admin._apps:
    
    if os.path.exists(SERVICE_ACCOUNT_KEY_PATH):
        try:
            cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
            firebase_admin.initialize_app(cred)
            print(" Firebase initialized successfully.")
        except Exception as e:
            print(f" Error initializing Firebase: {e}")
            raise e
    else:
        # Stop the server immediately if the key is missing to prevent confusing 500 errors later
        raise FileNotFoundError(
            f" CRITICAL ERROR: 'serviceAccountKey.json' was not found at: {SERVICE_ACCOUNT_KEY_PATH}\n"
            " Please download it from Firebase Console -> Project Settings -> Service Accounts -> Generate New Private Key\n"
            " Place the file inside the 'backend' folder."
        )

# 3. Export the Database Client
db = firestore.client()
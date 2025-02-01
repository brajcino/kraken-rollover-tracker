from fastapi import FastAPI
import httpx
import time
import hmac
import hashlib
import base64
import os
from dotenv import load_dotenv


load_dotenv()
API_KEY = os.getenv("KRAKEN_API_KEY")
API_SECRET = os.getenv("KRAKEN_API_SECRET")

app = FastAPI()

KRAKEN_API_URL = "https://api.kraken.com"

def generate_kraken_signature(url_path, data, secret):
    "Generates a Kraken API request signature."
    post_data = data.encode()
    encoded = (url_path.encode() + hashlib.sha256(post_data).digest())
    mac = hmac.new(base64.b64decode(secret), encoded, hashlib.sha512)
    return base64.b64decode(mac.digest()).decode()

async def fetch_ledger():
    "Fetches ledger history from Kraken API and filters rollover fees."
    url_path = "/0/private/Ledgers"
    
    data = {
        "nonce": str(int(time.time() * 1000)),
    }
    
    headers = {
        "API-Key": API_KEY,
        "API-Sign":generate_kraken_signature(url_path, "&".join([f"{key}={value}" for key, value in data.items()]), API_SECRET)
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url_path, headers=headers, data=data)
        result = response.json()
        
        if "error" in result and result["error"]:
            return {"error": result["error"]}
        
        ledgers = result.get("result", {})
        
        #Filter only "rollover"
        rollover_fees = []
        for entry in ledgers.values():
            if entry["type"] == "rollover":
                rollover_fees.append({
                    "time": entry["time"],
                    "asset": entry["asset"],
                    "fee": float(entry["fee"]),
                })
                
                
            return {"rollover_fees": rollover_fees}
        
@app.get("/rollover_fees")
async def get_rollover_fees():
        "API route to return rollover fee data"
        return await fetch_ledger()
    
    
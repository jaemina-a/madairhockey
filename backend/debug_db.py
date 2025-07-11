import os, mysql.connector
from dotenv import load_dotenv
load_dotenv()                               # .env 안 쓰면 주석 처리

DB_CONF = {
    "host":     os.getenv("MYSQL_HOST", "localhost"),
    "user":     os.getenv("MYSQL_USER", "airhockey"),
    "password": os.getenv("MYSQL_PASSWORD", "Party0781!"),
    "database": os.getenv("MYSQL_DB", "airhockey"),
}

print("🔎  DB_CONF =", DB_CONF)

try:
    cnx = mysql.connector.connect(**DB_CONF)
    print("✅  single connection OK")
    cnx.close()
except Exception as e:
    print("❌  connection failed →", type(e).__name__, e)

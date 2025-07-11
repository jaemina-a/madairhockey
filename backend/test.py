import mysql.connector, os
conn = mysql.connector.connect(
    user="root", password="1024", host="127.0.0.1",
    database="airhockey", use_pure=True    # 핵심
)
print("OK")
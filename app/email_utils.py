import os
from pathlib import Path
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr

BASE_DIR = Path(__file__).resolve().parent
TEMPLATE_FOLDER = BASE_DIR / "templates"

conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_FROM=os.getenv("MAIL_FROM"),
    MAIL_PORT=int(os.getenv("MAIL_PORT", 587)),
    MAIL_SERVER=os.getenv("MAIL_SERVER", "smtp.gmail.com"),
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True,
    TEMPLATE_FOLDER=TEMPLATE_FOLDER
)

async def send_welcome_email(email_to: EmailStr, username: str):
    template_body = {
        "username": username
    }

    message = MessageSchema(
        subject="Welcome to InventoryPro!",
        recipients=[email_to],
        template_body=template_body,
        subtype=MessageType.html
    )

    fm = FastMail(conf)

    await fm.send_message(message, template_name="welcome.html")
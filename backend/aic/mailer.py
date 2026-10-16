"""Outbound email.

``MAIL_PROVIDER`` selects the transport:
- ``brevo`` / ``resend``  HTTPS APIs — use these on Render's free tier, which
                          blocks outbound SMTP ports (25/465/587).
- ``smtp``                any SMTP server (paid hosts / self-hosted).
- ``console``             log messages instead of sending (development).
- empty                   email disabled.

Delivery never blocks or fails a request: messages are sent on a background
thread and failures are logged.
"""
import html
import json
import smtplib
import ssl
import threading
import urllib.error
import urllib.request
from email.message import EmailMessage

ORANGE = "#F47920"
INK = "#161616"


class Mailer:
    def __init__(self, config, logger):
        self.config = config
        self.logger = logger
        self.provider = config["MAIL_PROVIDER"]
        self.sent = []  # populated in console mode; used by tests

    @property
    def enabled(self):
        return bool(self.provider)

    def send(self, to, subject, body_html):
        if not self.enabled or not to:
            return
        if self.config["MAIL_ASYNC"] and self.provider != "console":
            threading.Thread(target=self._deliver, args=(to, subject, body_html), daemon=True).start()
        else:
            self._deliver(to, subject, body_html)

    def _deliver(self, to, subject, body_html):
        try:
            if self.provider == "console":
                self.sent.append({"to": to, "subject": subject, "html": body_html})
                self.logger.info("[mail:console] to=%s subject=%s", to, subject)
            elif self.provider == "brevo":
                self._post_json(
                    "https://api.brevo.com/v3/smtp/email",
                    {"api-key": self.config["BREVO_API_KEY"], "accept": "application/json"},
                    {
                        "sender": {"name": self.config["MAIL_FROM_NAME"], "email": self.config["MAIL_FROM"]},
                        "to": [{"email": to}],
                        "subject": subject,
                        "htmlContent": body_html,
                    },
                )
            elif self.provider == "resend":
                self._post_json(
                    "https://api.resend.com/emails",
                    {"Authorization": f"Bearer {self.config['RESEND_API_KEY']}"},
                    {
                        "from": f"{self.config['MAIL_FROM_NAME']} <{self.config['MAIL_FROM']}>",
                        "to": [to],
                        "subject": subject,
                        "html": body_html,
                    },
                )
            elif self.provider == "smtp":
                self._send_smtp(to, subject, body_html)
            else:
                self.logger.error("Unknown MAIL_PROVIDER '%s'; email to %s not sent", self.provider, to)
                return
            if self.provider != "console":
                self.logger.info("Email sent to %s (%s)", to, subject)
        except Exception as exc:  # never let email break the request
            self.logger.error("Email to %s failed via %s: %s", to, self.provider, exc)

    def _post_json(self, url, headers, payload):
        request = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", **headers},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                response.read()
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")[:300]
            raise RuntimeError(f"HTTP {exc.code}: {detail}") from exc

    def _send_smtp(self, to, subject, body_html):
        message = EmailMessage()
        message["From"] = f"{self.config['MAIL_FROM_NAME']} <{self.config['MAIL_FROM']}>"
        message["To"] = to
        message["Subject"] = subject
        message.set_content("This message requires an HTML-capable email client.")
        message.add_alternative(body_html, subtype="html")
        host, port = self.config["SMTP_HOST"], self.config["SMTP_PORT"]
        context = ssl.create_default_context()
        if port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=15, context=context)
        else:
            server = smtplib.SMTP(host, port, timeout=15)
            server.starttls(context=context)
        with server:
            if self.config["SMTP_USERNAME"]:
                server.login(self.config["SMTP_USERNAME"], self.config["SMTP_PASSWORD"])
            server.send_message(message)


def render_email(heading, paragraphs, details=None, closing="Regards,<br><strong>AIC MUJ Incubation Foundation</strong>"):
    """Build a simple branded HTML email. ``paragraphs`` and ``details`` values are escaped."""
    esc = html.escape
    body = "".join(f'<p style="margin:0 0 14px;line-height:1.55">{esc(p)}</p>' for p in paragraphs)
    rows = ""
    if details:
        rows = "".join(
            f'<tr><td style="padding:8px 12px 8px 0;color:#6B6B6B;white-space:nowrap;vertical-align:top">{esc(label)}</td>'
            f'<td style="padding:8px 0;color:{INK};font-weight:600">{esc(str(value or "—"))}</td></tr>'
            for label, value in details
        )
        rows = f'<table style="border-collapse:collapse;margin:4px 0 18px;font-size:14px">{rows}</table>'
    return f"""<!doctype html><html><body style="margin:0;background:#F6F4F1;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:{INK}">
<div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:8px;overflow:hidden;border:1px solid #E7E3DD">
<div style="height:4px;background:{ORANGE}"></div>
<div style="padding:28px 28px 8px">
<div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6B6B6B;margin-bottom:10px">AIC MUJ Incubation Foundation</div>
<h1 style="font-size:20px;line-height:1.3;margin:0 0 16px">{esc(heading)}</h1>
{body}{rows}
<p style="margin:0 0 24px;line-height:1.55">{closing}</p>
</div>
<div style="padding:14px 28px;background:#FAF8F5;border-top:1px solid #E7E3DD;font-size:12px;color:#6B6B6B">Manipal University Jaipur · This is an automated message.</div>
</div></body></html>"""

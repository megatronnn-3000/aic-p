"""Email content for application events."""
from . import db
from .mailer import render_email

PROGRAM_NAMES = {
    "preincubation": "Pre-Incubation Program",
    "incubation": "Incubation Program",
    "internship": "Internship Program",
}


def _applicant(program, record):
    if program == "preincubation":
        return record.get("founder_name") or record.get("name"), record.get("startup_name")
    if program == "incubation":
        return record.get("founder_name"), record.get("startup_name")
    return record.get("name"), None


def application_received(mailer, program, record):
    name, startup = _applicant(program, record)
    ref = db.reference(program, record["id"])
    details = [("Reference", ref), ("Program", PROGRAM_NAMES[program])]
    if startup:
        details.append(("Startup", startup))
    mailer.send(
        record["email"],
        f"We've received your application ({ref})",
        render_email(
            "Application received",
            [
                f"Hello {name or 'there'},",
                f"Thank you for applying to the AIC MUJ {PROGRAM_NAMES[program]}. "
                "Our team will review your application and contact you by email about next steps.",
            ],
            details,
        ),
    )


def admin_new_application(mailer, admin_email, program, record):
    if not admin_email:
        return
    name, startup = _applicant(program, record)
    ref = db.reference(program, record["id"])
    details = [("Reference", ref), ("Applicant", name), ("Email", record.get("email"))]
    if startup:
        details.append(("Startup", startup))
    if record.get("sector"):
        details.append(("Sector", record["sector"]))
    if record.get("preferred_role"):
        details.append(("Preferred role", record["preferred_role"]))
    mailer.send(
        admin_email,
        f"New {PROGRAM_NAMES[program]} application: {startup or name} ({ref})",
        render_email(
            f"New {PROGRAM_NAMES[program]} application",
            ["A new application was submitted through the AIC MUJ portal. Sign in to the staff workspace to review it."],
            details,
            closing="",
        ),
    )


STATUS_MESSAGES = {
    ("preincubation", "Approved"): (
        "You've been accepted into Pre-Incubation",
        "Congratulations! Your application has been accepted into the AIC MUJ Pre-Incubation Program. "
        "Our team will be in touch with onboarding details.",
    ),
    ("preincubation", "Rejected"): (
        "Update on your application",
        "Thank you for your interest in the AIC MUJ Pre-Incubation Program. After careful review, we are unable "
        "to offer you a place at this time. We encourage you to keep building and to apply again in future.",
    ),
    ("preincubation", "Graduated"): (
        "Congratulations on graduating",
        "Congratulations on graduating from the AIC MUJ Pre-Incubation Program. We look forward to your next steps.",
    ),
    ("incubation", "Approved"): (
        "You've been accepted into Incubation",
        "Congratulations! Your startup has been accepted into the AIC MUJ Incubation Program. "
        "Our team will be in touch with onboarding details.",
    ),
    ("incubation", "Rejected"): (
        "Update on your application",
        "Thank you for applying to the AIC MUJ Incubation Program. After careful review, we are unable to offer "
        "incubation at this time. We encourage you to apply again as your startup progresses.",
    ),
    ("internship", "Selected"): (
        "You've been selected for an internship",
        "Congratulations! You've been selected for an internship with AIC MUJ. Our team will contact you with details.",
    ),
    ("internship", "Rejected"): (
        "Update on your internship application",
        "Thank you for applying for an internship with AIC MUJ. We are unable to offer you a role at this time, "
        "but we encourage you to apply again for future openings.",
    ),
}


def status_changed(mailer, program, record, status):
    message = STATUS_MESSAGES.get((program, status))
    if not message:
        return False
    heading, text = message
    name, startup = _applicant(program, record)
    ref = db.reference(program, record["id"])
    details = [("Reference", ref)] + ([("Startup", startup)] if startup else [])
    mailer.send(
        record["email"],
        f"{heading} ({ref})",
        render_email(heading, [f"Hello {name or 'there'},", text], details),
    )
    return True


def pitch_scheduled(mailer, record):
    name, startup = _applicant("preincubation", record)
    details = [
        ("Startup", startup),
        ("Date", record.get("pitch_date")),
        ("Time", record.get("pitch_time")),
        ("Meeting link", record.get("pitch_link")),
    ]
    mailer.send(
        record["email"],
        f"Your pitch is scheduled ({db.reference('preincubation', record['id'])})",
        render_email(
            "Your evaluation pitch is scheduled",
            [f"Hello {name or 'there'},", "You've been invited to pitch your startup to the AIC MUJ evaluation panel."],
            details,
        ),
    )

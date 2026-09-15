from datetime import datetime
from ..database import SessionLocal
from ..models import Suspect
from ..schema_migrate import ensure_schema

DEMO_SUSPECTS = [
    {"suspect_code": "S001", "name": "Raj Kumar", "role": "Theft Suspect", "wanted": True, "image_path": "data/demo/S001-1.png", "reference_image_count": 5},
    {"suspect_code": "S002", "name": "Arjun Mehta", "role": "Fraud Suspect", "wanted": False, "reference_image_count": 0},
    {"suspect_code": "S003", "name": "Vikram Singh", "role": "Robbery Suspect", "wanted": True, "reference_image_count": 0},
    {"suspect_code": "S004", "name": "Anvi Mishra", "role": "Cyber Crime Suspect", "wanted": True, "image_path": "data/demo/S004-1.jpg", "reference_image_count": 1},
]


def seed_database():
    ensure_schema()
    with SessionLocal() as db:
        for item in DEMO_SUSPECTS:
            existing = db.query(Suspect).filter_by(suspect_code=item["suspect_code"]).first()
            values = {
                **item,
                "include_in_officer_directory": True,
                "enrollment_status": "REAL_ENROLLMENT" if item.get("image_path") else "PROCESSING",
                "enrollment_date": datetime(2026, 3, 12, 9, 0, 0),
                "data_origin": "OPERATIONAL",
            }
            if not existing:
                db.add(Suspect(**values))
            else:
                existing.name = item["name"]
                existing.role = item["role"]
                existing.wanted = item["wanted"]
                if item.get("image_path"):
                    existing.image_path = item["image_path"]
                existing.include_in_officer_directory = True
                existing.reference_image_count = item.get("reference_image_count", 0)
                if not existing.enrollment_status:
                    existing.enrollment_status = values["enrollment_status"]
        db.commit()


def main():
    seed_database()
    print("CINTRA demo database seeded.")


if __name__ == "__main__":
    main()

"""Lista las clínicas y sus usuarios para verificar contra qué clínica apuntó el seed."""
import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal


async def main():
    async with AsyncSessionLocal() as s:
        rows = await s.execute(text("""
            SELECT c.id, c.name, c.email, c.created_at,
                   (SELECT COUNT(*) FROM users u WHERE u.clinic_id = c.id AND u.deleted_at IS NULL) AS users,
                   (SELECT COUNT(*) FROM owners o WHERE o.clinic_id = c.id AND o.deleted_at IS NULL) AS owners
            FROM clinics c
            WHERE c.deleted_at IS NULL
            ORDER BY c.created_at
        """))
        for r in rows.mappings():
            print(f"  id={r['id']}  name={r['name']}  email={r['email']}  users={r['users']}  owners={r['owners']}")


if __name__ == "__main__":
    asyncio.run(main())

"""Verifica cuántos registros DEMO hay en la DB."""
import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal


QUERIES = [
    ("owners DEMO",           "SELECT COUNT(*) FROM owners WHERE address LIKE 'DEMO%'"),
    ("patients DEMO",         "SELECT COUNT(*) FROM patients WHERE notes LIKE 'DEMO%'"),
    ("products DEMO",         "SELECT COUNT(*) FROM products WHERE sku LIKE 'DEMO-%'"),
    ("appointments DEMO",     "SELECT COUNT(*) FROM appointments WHERE notes LIKE 'DEMO%'"),
    ("stock_movements DEMO",  "SELECT COUNT(*) FROM stock_movements WHERE reason LIKE 'DEMO%'"),
    ("product_categories",    "SELECT COUNT(*) FROM product_categories"),
]


async def main():
    async with AsyncSessionLocal() as s:
        for name, sql in QUERIES:
            r = await s.execute(text(sql))
            print(f"  {name}: {r.scalar()}")


if __name__ == "__main__":
    asyncio.run(main())

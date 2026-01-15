from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_
from .. import models, schemas, database, dependencies

router = APIRouter(
    tags=["Products"]
)

@router.get("/", response_model=List[schemas.ProductResponse])
async def get_products(
    category: Optional[str] = None, 
    search: Optional[str] = None, 
    db: AsyncSession = Depends(database.get_db)
):
    filters = []

    if category and category not in ["null", "undefined", "All Products"]:
        filters.append(models.Product.category == category)

    if search and search.strip():
        search_term = f"%{search.strip()}%"
        filters.append(models.Product.name.ilike(search_term))
    
    query = select(models.Product)
    if filters:
        query = query.where(and_(*filters))

    print(f"Applying Filters: {filters}")
    
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{product_id}", response_model=schemas.ProductResponse)
async def get_product(product_id: int, db: AsyncSession = Depends(database.get_db)):
    result = await db.execute(select(models.Product).where(models.Product.id == product_id))
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@router.post("/", response_model=schemas.ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    product: schemas.ProductCreate,
    db: AsyncSession = Depends(database.get_db),
    _: models.User = Depends(dependencies.get_current_user)
):
    print(f"--- SAVING PRODUCT: {product.name} in CATEGORY: {product.category} ---")
    new_product = models.Product(**product.dict())

    db.add(new_product)
    await db.commit()
    await db.refresh(new_product)
    return new_product

@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: int,
    db: AsyncSession = Depends(database.get_db),
    _: models.User =  Depends(dependencies.get_current_user)
):
    result = await db.execute(select(models.Product).where(models.Product.id == product_id))
    product = result.scalars().first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    await db.delete(product)
    await db.commit()
    return None

@router.patch("/{product_id}", response_model=schemas.ProductResponse)
async def update_product(
    product_id: int,
    product_update: schemas.ProductUpdate, 
    db: AsyncSession = Depends(database.get_db),
    _: models.User = Depends(dependencies.get_current_user)
):
    result = await db.execute(select(models.Product).where(models.Product.id == product_id))
    db_product = result.scalars().first()

    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = product_update.dict(exclude_unset=True)

    for key, value in update_data.items():
        setattr(db_product, key, value)
    
    await db.commit()
    await db.refresh(db_product)
    return db_product
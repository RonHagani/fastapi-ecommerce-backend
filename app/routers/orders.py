from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from pydantic import BaseModel
from .. import models, database, dependencies

router = APIRouter(
    prefix="/orders",
    tags=["Orders"]
)

# Schema for incoming order (List of product IDs)
class OrderCreate(BaseModel):
    product_ids: List[int]

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_order(
    order_data: OrderCreate,
    db: AsyncSession = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    # 1. Calculate Total Price (Server Side Security)
    total_price = 0.0
    
    # Check if products exist and sum price
    # Note: In a real app, do this in one query using 'IN' clause
    for pid in order_data.product_ids:
        result = await db.execute(select(models.Product).where(models.Product.id == pid))
        product = result.scalars().first()
        if product:
            total_price += product.price
    
    if total_price == 0:
        raise HTTPException(status_code=400, detail="No valid products in order")

    # 2. Create Order
    new_order = models.Order(
        user_id=current_user.id,
        total_price=total_price,
        status="Processing"
    )
    
    db.add(new_order)
    await db.commit()
    await db.refresh(new_order)
    
    return {"message": "Order created successfully", "order_id": new_order.id, "total": total_price}

@router.patch("/{order_id}/cancel")
async def cancel_order(
    order_id: int,
    db: AsyncSession = Depends(database.get_db),
    current_user: models.User = Depends(dependencies.get_current_user)
):
    # Fetch order and ensure it belongs to the user
    result = await db.execute(select(models.Order).where(models.Order.id == order_id, models.Order.user_id == current_user.id))
    order = result.scalars().first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status != "Processing":
        raise HTTPException(status_code=400, detail="Cannot cancel order that is already shipped or cancelled")

    order.status = "Cancelled"
    await db.commit()
    
    return {"message": "Order cancelled successfully"}
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.future import select
from datetime import timedelta
from .. import models, schemas, utils, database, config, dependencies
from ..email_utils import send_welcome_email

router = APIRouter(
    tags=["Authentication"]
)

@router.post("/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user: schemas.UserCreate, 
    background_tasks: BackgroundTasks, 
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(select(models.User).where(models.User.email == user.email))
    existing_user = result.scalars().first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )
    
    hashed_password = utils.get_password_hash(user.password)

    new_user = models.User(
        email=user.email,
        username=user.username,
        hashed_password=hashed_password,
        role="user",
        is_active=True
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    background_tasks.add_task(send_welcome_email, new_user.email, new_user.username)

    return new_user

@router.post("/login", response_model=schemas.Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(database.get_db)):
    result = await db.execute(select(models.User).where(models.User.email == form_data.username))
    user = result.scalars().first()

    if not user or not utils.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    
    access_token_expires = timedelta(minutes=config.settings.access_token_expire_minutes)
    access_token = utils.create_access_token(
        data={"sub": str(user.id)},
        expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=schemas.UserProfile)
async def read_users_me(
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    """
    Get current user profile with orders and address.
    """
    query = select(models.User).options(
        selectinload(models.User.orders),
        selectinload(models.User.address)
    ).where(models.User.id == current_user.id)
    
    result = await db.execute(query)
    user = result.scalars().first()
    
    return user

@router.post("/address", response_model=schemas.AddressModel)
async def update_address(
    address_data: schemas.AddressCreate,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    # Check if address exists
    query = select(models.Address).where(models.Address.user_id == current_user.id)
    result = await db.execute(query)
    db_address = result.scalars().first()

    if db_address:
        # Update existing
        db_address.street = address_data.street
        db_address.city = address_data.city
        db_address.zip_code = address_data.zip_code
    else:
        # Create new
        db_address = models.Address(
            user_id=current_user.id,
            street=address_data.street,
            city=address_data.city,
            zip_code=address_data.zip_code
        )
        db.add(db_address)
    
    await db.commit()
    await db.refresh(db_address)
    return db_address
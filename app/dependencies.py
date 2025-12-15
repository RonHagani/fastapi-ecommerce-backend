from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from . import database, models, config

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(database.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, config.settings.secret_key, algorithms=config.settings.algorithm)
        username: str = payload.get("sub")

        if username is None:
            raise credentials_exception
    
    except JWTError:
        raise credentials_exception
    
    result = await db.execute(
        select(models.User).where(models.User.username == username)
    )
    user = result.scalars().first()

    if user is None:
        raise credentials_exception

    return user
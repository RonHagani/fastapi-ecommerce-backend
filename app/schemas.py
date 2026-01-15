from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator
from typing import Optional, List
import re
from datetime import datetime


class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class ProductBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=50, description="Product name must be between 2 and 50 characters")
    description: Optional[str] = None
    specs: Optional[str] = None
    price: float = Field(..., gt=0, description="Price must be greater than 0")
    stock: int = Field(..., gt=0, description="Stock must be greater than 0")
    image_url: Optional[str] = None
    category: str

class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=50)
    description: Optional[str] = None
    specs: Optional[str] = None
    price: Optional[float] = Field(None, gt=0, description="Price must be greater than 0")
    stock: Optional[int] = Field(None, gt=0, description="Stock must be greater than 0")
    image_url: Optional[str] = None
    category: Optional[str] = None

class ProductCreate(ProductBase):
    pass

class ProductResponse(ProductBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class UserBase(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)

class UserCreate(UserBase):
    email: EmailStr
    username: str
    password: str

    @field_validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        
        if not re.search(r"\d", v):
            raise ValueError('Password must contain at least one number')
        
        if not re.search(r"[a-zA-Z]", v):
            raise ValueError('Password must contain at least one letter')
        
        return v

class UserResponse(UserBase):
    id: int
    role: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)

class AddressModel(BaseModel):
    street: str
    city: str
    zip_code: str
    
    model_config = ConfigDict(from_attributes=True)

class AddressCreate(BaseModel):
    street: str
    city: str
    zip_code: str

class OrderModel(BaseModel):
    id: int
    total_price: float
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class UserProfile(UserBase):
    id: int
    email: EmailStr
    role: str
    address: Optional[AddressModel] = None
    orders: List[OrderModel] = []

    model_config = ConfigDict(from_attributes=True)
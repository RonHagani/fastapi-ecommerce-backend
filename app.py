import os
import time
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import OperationalError

# --- Database Setup ---
DATABASE_URL = os.environ.get('DATABASE_URL')

def get_engine_with_retry():
    retries = 5
    while retries > 0:
        try:
            engine = create_engine(DATABASE_URL)
            with engine.connect():
                pass
            return engine
        except Exception:
            print(f"Database not ready... retrying in 5s ({retries} left)")
            time.sleep(5)
            retries -= 1
    raise Exception("Could not connect to database after 5 retries")

engine = get_engine_with_retry()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- Model ---
class ProductModel(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String)
    price = Column(Float)
    stock = Column(Integer)

Base.metadata.create_all(bind=engine)

# --- Pydantic Schemas ---
class ProductCreate(BaseModel):
    name: str
    description: str
    price: float
    stock: int

app = FastAPI(title="Store Inventory API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Routes ---

@app.get("/")
def home():
    return {"message": "Welcome to the Inventory System API!"}

@app.get("/products")
def get_products():
    db = SessionLocal()
    products = db.query(ProductModel).all()
    db.close()
    return products

@app.post("/products")
def create_product(product: ProductCreate):
    db = SessionLocal()

    existing_product = db.query(ProductModel).filter(ProductModel.name == product.name).first()

    if existing_product:
        print(f"Product {product.name} exists! Updating stock.")
        existing_product.stock += product.stock
        existing_product.price = product.price
        existing_product.description = product.description

        db.commit()
        db.refresh(existing_product)
        db.close()
        return existing_product
    
    else:
        print(f"New product {product.name}. Creating.")
        new_product = ProductModel(
            name = product.name,
            description = product.description,
            price = product.price,
            stock = product.stock
        )

        db.add(new_product)
        db.commit()
        db.refresh(new_product)
        db.close()
        return new_product

@app.put('/products/{product_id}')
def update_product(product_id: int, product: ProductCreate):
    db = SessionLocal()
    db_product = db.query(ProductModel).filter(ProductModel.id == product_id).first()

    if db_product is None:
        db.close()
        raise HTTPException(status_code=404, detail="Product not found")
    
    db_product.name =  product.name
    db_product.description = product.description
    db_product.price = product.price
    db_product.stock = product.stock

    db.commit()
    db.refresh(db_product)
    db.close()
    return db_product
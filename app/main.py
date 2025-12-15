from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import auth, products
from .config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting up database connection...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    print("Shutting down...")

app = FastAPI(
    title="Advanced Task Manager API",
    description="A production-ready API with Authentication, JWT, and Roles",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(products.router)

@app.get("/")
def root():
    return {"message": "Welcome to the Advanced API", "docs": "/docs"}
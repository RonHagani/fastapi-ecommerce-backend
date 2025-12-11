import os
import time
from fastapi import FastAPI
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import OperationalError

DATABASE_URL = os.environ.get('DATABASE_URL')

def get_engine_with_retry():
    retries = 5
    while retries > 0:
        try:
            print("Connecting to Database...")
            engine = create_engine(DATABASE_URL)
            with engine.connect() as conn:
                pass
            print("Database connected successfully!")
            return engine
        except OperationalError:
            print("Database not ready yet... waiting 5 seconds")
            time.sleep(5)
            retries -= 1
    raise Exception("Could not connect to database after 5 retries")

engine = get_engine_with_retry()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class TaskModel(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    done = Column(Boolean, default=False)

Base.metadata.create_all(bind=engine)

class TaskCreate(BaseModel):
    title: str
    done: bool = False

class TaskResponse(BaseModel):
    id: int
    title: str
    done: bool

    class Config:
        orm_mode = True

app = FastAPI()

@app.get("/")
def home():
    return {"message": "Welcome to FastAPI Task Manager!"}

@app.get("/tasks", response_model=list[TaskResponse])
def get_tasks():
    db = SessionLocal()
    tasks = db.query(TaskModel).all()
    db.close()
    return tasks

@app.post("/tasks", response_model=TaskResponse)
def add_task(task: TaskCreate):
    db = SessionLocal()
    db_task = TaskModel(title=task.title, done=task.done)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    db.close()
    return db_task
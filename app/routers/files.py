from fastapi import APIRouter, UploadFile, File, Depends, status
import shutil
import os
from .. import dependencies

router = APIRouter(
    tags=["Files"]
)

IMAGEDIR = "app/static/images/"
os.makedirs(IMAGEDIR, exist_ok=True)

@router.post("/upload/", status_code=status.HTTP_201_CREATED)
async def upload_image(
    file: UploadFile = File(...),
    current_user: int = Depends(dependencies.get_current_user)
):
    file_location = f"{IMAGEDIR}{file.filename}"

    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)

    url = f"/static/images/{file.filename}"
    return {"url": url}
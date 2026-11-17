from datetime import datetime, timezone
from pathlib import Path
from secrets import compare_digest

import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from tortoise import Tortoise
from tortoise.contrib.fastapi import register_tortoise
from tortoise.contrib.pydantic import pydantic_model_creator
from tortoise.exceptions import ValidationError

from server.models import Picture, User

app = FastAPI()

models = {"models": ["server.models"]}
connection = {
    "engine": "tortoise.backends.asyncpg",
    "credentials": {
        "host": os.environ["POSTGRES_HOST"],
        "port": 5432,
        "user": os.environ["POSTGRES_USER"],
        "password": os.environ["POSTGRES_PASSWORD"],
        "database": os.environ["POSTGRES_DB"],
    },
}

database = {
    "connections": {"default": connection},
    "apps": {"models": {"models": models["models"], "default_connection": "default"}},
}
register_tortoise(app, config=database, add_exception_handlers=True, generate_schemas=True)
API_WRITE_TOKEN = os.getenv("API_WRITE_TOKEN", "")
MAX_IMAGE_SIZE = int(os.getenv("MAX_IMAGE_SIZE_MB", "10")) * 1024 * 1024

app.add_middleware(
    CORSMiddleware,
    # allow_origins=["http://localhost:5173"],
    allow_origins=["*"],
)


@app.exception_handler(ValidationError)
async def validation_error_handler(request: Request, exc: ValidationError):
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.middleware("http")
async def restrict_writes(request: Request, call_next):
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        if API_WRITE_TOKEN:
            supplied_token = request.headers.get("X-API-Write-Token", "")
            allowed = compare_digest(supplied_token.encode(), API_WRITE_TOKEN.encode())
        else:
            allowed = request.client is not None and request.client.host in ("127.0.0.1", "::1")
        if not allowed:
            return JSONResponse(status_code=403, content={"detail": "Forbidden"})
    return await call_next(request)


# важно сделать это до создания pydantic схем
Tortoise.init_models(["server.models"], "models")

CreateUserRequest = pydantic_model_creator(
    User, name="CreateUserRequest",
    include=('tg_id', 'tg_tag', 'username'))

UserResponse = pydantic_model_creator(
    User, name="UserResponse",
    include=('id', 'tg_id', 'tg_tag', 'username', 'is_banned', 'daily_limit'))

UpdateUserRequest = pydantic_model_creator(
    User, name="UpdateUserRequest",
    include=('username', 'tg_tag', 'is_banned', 'daily_limit'),
    optional=('username', 'tg_tag', 'is_banned', 'daily_limit'))

UploadPictureRequest = pydantic_model_creator(
    Picture, name="UploadPictureRequest",
    include=('filename', 'tg_id', 'label'))

PictureResponse = pydantic_model_creator(
    Picture, name="PictureResponse",
    include=('id', 'filename', 'tg_id', 'created_at', 'accepted', 
             'check_details', 'label', 'accepted_at'))

UpdatePictureRequest = pydantic_model_creator(
    Picture, name="UpdatePictureRequest",
    include=('accepted', 'check_details', 'accepted_at'),
    optional=('accepted', 'check_details', 'accepted_at'))


# --- Пользователи ---


@app.post("/users", response_model=UserResponse)
async def create_user(body: CreateUserRequest):  # type: ignore
    user, _ = await User.get_or_create(
        tg_id=body.tg_id,
        defaults={"tg_tag": body.tg_tag, "username": body.username},
    )
    return user


@app.get("/users", response_model=list[UserResponse])
async def get_all_users():
    return await User.all()


@app.get("/users/{tg_id}", response_model=UserResponse)
async def get_user(tg_id: int):
    return await User.get(tg_id=tg_id)


@app.patch("/users/{tg_id}", response_model=UserResponse)
async def patch_user(tg_id: int, body: UpdateUserRequest):  # type: ignore
    user = await User.get(tg_id=tg_id)
    await user.update_from_dict(body.dict(exclude_unset=True)).save()
    return user


# --- Изображения ---

@app.post("/users/{tg_id}/pictures", response_model=PictureResponse)
async def upload(tg_id: int, body: UploadPictureRequest):  # type: ignore
    user = await User.get(tg_id=tg_id)

    today_start = datetime.now(tz=timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0)
    daily_count = await Picture.filter(created_by=user, created_at__gt=today_start).count()
    if daily_count >= user.daily_limit:
        raise HTTPException(
            status_code=429, detail="Daily upload limit reached")

    if not Path(body.filename).exists():
        raise HTTPException(
            status_code=400, detail=f"File {body.filename} doesn't exist")

    if Path(body.filename).stat().st_size > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="Image file is too large")

    picture = await Picture.create(
        filename=body.filename, tg_id=body.tg_id, created_by=user, label=body.label)
    return picture


@app.get("/pictures", response_model=list[PictureResponse])
async def get_pictures(from_date: datetime | None = None, to_date: datetime | None = None):
    query = Picture.filter(accepted=True)
    if from_date is not None:
        query = query.filter(accepted_at__gte=from_date)
    if to_date is not None:
        query = query.filter(accepted_at__lte=to_date)
    pictures = await query.order_by("-accepted_at", "-id")
    return [picture for picture in pictures if Path(picture.filename).is_file()]


@app.get("/pictures/{picture_id}/download")
async def download_picture(picture_id: int):
    picture = await Picture.get_or_none(id=picture_id)
    if picture is None or not Path(picture.filename).exists():
        raise HTTPException(status_code=404, detail="Picture not found")
    return FileResponse(picture.filename)


@app.patch("/pictures/{picture_id}", response_model=PictureResponse)
async def patch_picture(picture_id: int, body: UpdatePictureRequest):  # type: ignore
    picture = await Picture.get_or_none(id=picture_id)
    if picture is None:
        raise HTTPException(status_code=404, detail="Picture not found")
    await picture.update_from_dict(body.dict(exclude_unset=True)).save()
    return picture


# --- Статика — должно быть последним ---

static_directory = os.getenv("STATIC_DIR", str(Path(__file__).parent / "static"))
app.mount("/", StaticFiles(directory=static_directory, html=True), name="static")

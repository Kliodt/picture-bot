from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message


router = Router()


@router.message(Command("help"))
async def command_help_handler(message: Message) -> None:
    await message.answer("Поделись фото своей подготовки к гала-концерту — это может быть костюм, репетиция или просто атмосфера подготовки. Твоё фото появится на экранах в холле 2 этажа. \nПодозрительные фотографии проходят дополнительную модерацию, поэтому могут появиться не сразу.\nКоманда /support для связи с поддержкой✌️")

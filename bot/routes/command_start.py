from aiogram import Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import Message

from bot.api import Api


router = Router()


@router.message(Command("start"))
async def command_start_handler(message: Message, state: FSMContext) -> None:
    assert message.from_user is not None
    await state.clear()
    user = message.from_user
    await Api.createUser(
        tg_id=user.id,
        tg_tag=user.username or "",
        username=user.full_name,
    )
    await message.answer("Привет! 👋 Добро пожаловать в бот MEGABATTLE NOW. \n\nПоделись фото своей подготовки к гала-концерту — это может быть костюм, репетиция или просто атмосфера подготовки. Твоё фото появится на экранах в холле 2 этажа")

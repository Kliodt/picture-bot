from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

router = Router()


@router.message(Command("megabattle"))
async def command_help_handler(message: Message) -> None:
    await message.answer("💙MEGABATTLE💙")

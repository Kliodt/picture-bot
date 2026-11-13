from enum import Enum
from tortoise import Model, Tortoise
from tortoise import fields
from tortoise.fields import OnDelete
from tortoise.contrib.pydantic import pydantic_model_creator


class User(Model):

    id = fields.BigIntField(primary_key=True)
    tg_id = fields.BigIntField(unique=True, db_index=True)
    tg_tag = fields.CharField(max_length=256)
    is_banned = fields.BooleanField(default=False)

    username = fields.CharField(max_length=256)

    daily_limit = fields.IntField(default=30)

    class Meta(Model.Meta):
        table="users"
    

class Picture(Model):

    id = fields.IntField(primary_key=True)
    filename = fields.CharField(max_length=256)
    tg_id = fields.CharField(max_length=256)
    created_by = fields.ForeignKeyField(User, on_delete=OnDelete.CASCADE)
    created_at = fields.DatetimeField(auto_now_add=True)
    label = fields.CharField(max_length=256, default="")

    accepted = fields.BooleanField(null=True)
    accepted_at = fields.DatetimeField(null=True)
    check_details = fields.CharField(max_length=256, default="")

    class Meta(Model.Meta):
        table="pictures"


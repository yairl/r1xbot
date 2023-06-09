"""Initial migration.

Revision ID: 05e95b22503f
Revises: 
Create Date: 2023-05-10 01:55:00.147864

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '05e95b22503f'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index('user_settings_created_at', table_name='user_settings')
    op.drop_index('user_settings_user_id', table_name='user_settings')
    op.create_index(op.f('ix_user_settings_createdAt'), 'user_settings', ['createdAt'], unique=False)
    op.create_index(op.f('ix_user_settings_user_id'), 'user_settings', ['user_id'], unique=False)
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f('ix_user_settings_user_id'), table_name='user_settings')
    op.drop_index(op.f('ix_user_settings_createdAt'), table_name='user_settings')
    op.create_index('user_settings_user_id', 'user_settings', ['user_id'], unique=False)
    op.create_index('user_settings_created_at', 'user_settings', ['createdAt'], unique=False)
    # ### end Alembic commands ###

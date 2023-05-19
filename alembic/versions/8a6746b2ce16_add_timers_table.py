"""add timers table

Revision ID: 8a6746b2ce16
Revises: 7a4408168dda
Create Date: 2023-05-20 01:05:43.449156

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = '8a6746b2ce16'
down_revision = '7a4408168dda'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'timers',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('chat_id', sa.String, index=True),
        sa.Column('trigger_timestamp', sa.DateTime, index=True),
        sa.Column('data', JSONB),
        sa.Column('created_at', sa.DateTime),
        sa.Column('updated_at', sa.DateTime)
    )

def downgrade():
    op.drop_table('timers')


"""Add events table.

Revision ID: 7a4408168dda
Revises: 05e95b22503f
Create Date: 2023-05-14 23:03:50.906104

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = '7a4408168dda'
down_revision = '05e95b22503f'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'events',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('type', sa.String),
        sa.Column('ref_table', sa.String),
        sa.Column('ref_id', sa.Integer),
        sa.Column('body', JSONB),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
    )
    op.create_index('ix_events_type', 'events', ['type'])
    op.create_index('ix_events_ref', 'events', ['ref_table', 'ref_id'])

def downgrade():
    op.drop_index('ix_events_ref', table_name='events')
    op.drop_index('ix_events_type', table_name='events')
    op.drop_table('events')


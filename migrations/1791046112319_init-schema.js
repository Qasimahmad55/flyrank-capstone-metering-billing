/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.createTable('tenants', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'varchar(255)', notNull: true },
    stripe_customer_id: { type: 'varchar(255)', unique: true, notNull: false },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createTable('plans', {
    id: { type: 'varchar(50)', primaryKey: true },
    name: { type: 'varchar(255)', notNull: true },
    api_call_limit: { type: 'integer', notNull: true },
    ai_token_limit: { type: 'integer', notNull: true },
  });

  pgm.createTable('subscriptions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: {
      type: 'uuid',
      notNull: true,
      references: '"tenants"',
      onDelete: 'CASCADE',
    },
    plan_id: {
      type: 'varchar(50)',
      notNull: true,
      references: '"plans"',
      onDelete: 'RESTRICT',
    },
    stripe_subscription_id: { type: 'varchar(255)', unique: true, notNull: false },
    status: { type: 'varchar(50)', notNull: true, default: 'active' },
    current_period_start: { type: 'timestamp', notNull: true },
    current_period_end: { type: 'timestamp', notNull: true },
  });

  pgm.createTable('usage_events', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: {
      type: 'uuid',
      notNull: true,
      references: '"tenants"',
      onDelete: 'CASCADE',
    },
    idempotency_key: { type: 'varchar(255)', notNull: true },
    type: { type: 'varchar(50)', notNull: true }, 
    quantity: { type: 'integer', notNull: true },
    timestamp: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.addConstraint('usage_events', 'unique_tenant_idempotency_key', {
    unique: ['tenant_id', 'idempotency_key'],
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropTable('usage_events');
  pgm.dropTable('subscriptions');
  pgm.dropTable('plans');
  pgm.dropTable('tenants');
};

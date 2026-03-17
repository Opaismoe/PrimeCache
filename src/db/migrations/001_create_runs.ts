import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('runs', (t: Knex.TableBuilder) => {
    t.increments('id')
    t.string('group_name').notNullable()
    t.datetime('started_at').notNullable()
    t.datetime('ended_at')
    t.string('status').notNullable()   // running | completed | partial_failure | failed
    t.integer('total_urls')
    t.integer('success_count')
    t.integer('failure_count')
  })
}
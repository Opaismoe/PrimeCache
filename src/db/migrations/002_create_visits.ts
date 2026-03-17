import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex.schema.createTable('visits', (t: Knex.TableBuilder) => {
    t.increments('id')
    t.integer('run_id').references('id').inTable('runs').notNullable()
    t.string('url').notNullable()
    t.integer('status_code')
    t.string('final_url')
    t.integer('ttfb_ms')
    t.integer('load_time_ms')
    t.boolean('consent_found')
    t.string('consent_strategy')
    t.text('error')
    t.datetime('visited_at').notNullable()
  })
}
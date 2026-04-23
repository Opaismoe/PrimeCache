# T05 — Add Config/Settings Tab to Group Detail Page

**Wave:** 2 (parallel with T04, T06)
**Status:** todo

## Goal

Add a "Settings" tab to the group detail page (`/groups/:name`) that lets users edit this specific group's configuration inline — name, schedule, URLs, options. This surfaces the per-group edit form (already in `GroupForm.tsx`) directly inside the project/group view.

## Context

- Group detail page: `frontend/src/routes/groups_.$groupName.tsx`
- Existing edit form: `frontend/src/components/GroupForm.tsx`
  - Already used in `/config` page for add/edit
  - Accepts `initialValues` prop (the group to edit) and `onSubmit` callback
- Existing API: `PUT /api/config` — replaces the full config
- Config data: loaded via `getConfig()` → `/api/config`

## Files to Modify

- `frontend/src/routes/groups_.$groupName.tsx`
  - Add `"settings"` to the tab list (render last, as a gear/settings tab)
  - Add `<TabsContent value="settings">` containing `<GroupForm>`
  - Fetch current config to get the group's existing values
  - On form submit: call `PUT /api/config` with the updated group merged into the full config
  - On success: invalidate config query, show success toast

## Important: Config Save Logic

The config stores all groups. To edit one group:
1. Load full config via `getConfig()`
2. Find the group by name
3. Submit `<GroupForm initialValues={group}>`
4. On form submit: replace that group in the full config array → `PUT /api/config`

If the group name changes, the route must navigate to `/groups/<newName>` after save.

```typescript
const onSave = async (updated: GroupConfig) => {
  const newConfig = {
    ...config,
    groups: config.groups.map(g => g.name === groupName ? updated : g)
  }
  await putConfig(newConfig)
  queryClient.invalidateQueries({ queryKey: queryKeys.config() })
  if (updated.name !== groupName) {
    navigate({ to: '/groups/$groupName', params: { groupName: updated.name } })
  }
}
```

## Steps

1. Read `frontend/src/routes/groups_.$groupName.tsx` — understand existing tab and query pattern
2. Read `frontend/src/components/GroupForm.tsx` — confirm `initialValues` and `onSubmit` props
3. Read `frontend/src/lib/api.ts` — confirm `putConfig()` exists
4. Add `"settings"` to `<TabsList>` (use a settings/gear icon from lucide-react)
5. Add `<TabsContent value="settings">` — render `<GroupForm>` with the current group values
6. Implement the save handler (merge + PUT + invalidate + optional navigate)
7. Run `pnpm typecheck` — must pass

## Definition of Done

- Group detail page has a "Settings" tab
- Tab shows the group edit form pre-filled with the group's current config
- Saving updates the config and shows success feedback
- Renaming a group navigates to the new group URL
- No TypeScript errors
- Commit: `feat(ui): add Settings tab to group detail page`
